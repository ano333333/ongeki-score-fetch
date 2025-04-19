import http from "node:http";
import { getMusicInfoFromOngekiMypage } from "./getMusicInfoFromOngekiMypage";
import { getSpreadsheetBeatmapInfos } from "./getSpreadsheetBeatmapInfos";
import { compileReturnResults } from "./compileReturnResults";
import { dumpReturnResultCsv } from "./dumpReturnResultCsv";
import fs from "node:fs";
import { uploadToSheetStorage } from "./uploadToBucket";
import { loadOldCompiledResults } from "./loadOldCompiledResults";

const server = http.createServer(async (req, res) => {
	try {
		console.log(`${req.method} ${req.url}`);
		const musicInfoList = await getMusicInfoFromOngekiMypage();
		const spreadsheetBeatmapInfos = await getSpreadsheetBeatmapInfos();
		const newCompiledResults = compileReturnResults(
			musicInfoList,
			spreadsheetBeatmapInfos,
		);

		const oldCompiledResults = await loadOldCompiledResults("result.csv");
		if (
			JSON.stringify(newCompiledResults) !== JSON.stringify(oldCompiledResults)
		) {
			const resultString = dumpReturnResultCsv(newCompiledResults);
			fs.writeFileSync("result.csv", resultString);
			await uploadToSheetStorage("result.csv", "result.csv");
		}
	} catch (e) {
		console.error(e);
	} finally {
		res.statusCode = 200;
		res.end();
	}
});

server.listen(8080, () => {
	console.log("Server running at http://localhost:8080/");
});
