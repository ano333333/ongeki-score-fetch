import http from "node:http";
import { getMusicInfoFromOngekiMypage } from "./getMusicInfoFromOngekiMypage";
import { getSpreadsheetBeatmapInfos } from "./getSpreadsheetBeatmapInfos";
import { compileReturnResults } from "./compileReturnResults";
import { dumpReturnResultCsv } from "./dumpReturnResultCsv";
import fs from "node:fs";
import { uploadToSheetStorage } from "./uploadToBucket";

const server = http.createServer(async (req, res) => {
	console.log(`${req.method} ${req.url}`);
	const musicInfoList = await getMusicInfoFromOngekiMypage();
	const spreadsheetBeatmapInfos = await getSpreadsheetBeatmapInfos();
	const results = compileReturnResults(musicInfoList, spreadsheetBeatmapInfos);
	const resultString = dumpReturnResultCsv(results);
	fs.writeFileSync("result.csv", resultString);
	const dateFormat = new Date()
		.toLocaleString("ja-JP", {
			timeZone: "Asia/Tokyo",
		})
		.replace("/", "-")
		.replace("/", "-");
	const fileKey = `result ${dateFormat}.csv`;
	await uploadToSheetStorage("result.csv", fileKey);
	res.statusCode = 200;
	res.end();
});

server.listen(8080, () => {
	console.log("Server running at http://localhost:8080/");
});
