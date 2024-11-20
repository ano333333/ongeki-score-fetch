import http from "node:http";
import { getMusicInfoFromOngekiMypage } from "./getMusicInfoFromOngekiMypage";
import { getSpreadsheetBeatmapInfos } from "./getSpreadsheetBeatmapInfos";
import { compileReturnResults } from "./compileReturnResults";
import { dumpReturnResultCsv } from "./dumpReturnResultCsv";

const server = http.createServer(async (req, res) => {
	console.log(`${req.method} ${req.url}`);
	const musicInfoList = await getMusicInfoFromOngekiMypage();
	const spreadsheetBeatmapInfos = await getSpreadsheetBeatmapInfos();
	const results = compileReturnResults(musicInfoList, spreadsheetBeatmapInfos);
	const resultString = dumpReturnResultCsv(results);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/csv");
	res.end(resultString);
});

server.listen(8080, () => {
	console.log("Server running at http://localhost:8080/");
});
