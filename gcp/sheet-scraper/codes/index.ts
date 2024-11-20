import http from "node:http";
import { getMusicInfoFromOngekiMypage } from "./getMusicInfoFromOngekiMypage";
import { getSpreadsheetBeatmapInfos } from "./getSpreadsheetBeatmapInfos";
import { compileReturnResults } from "./compileReturnResults";

const server = http.createServer(async (req, res) => {
	console.log(`${req.method} ${req.url}`);
	const musicInfoList = await getMusicInfoFromOngekiMypage();
	const spreadsheetBeatmapInfos = await getSpreadsheetBeatmapInfos();
	const results = compileReturnResults(musicInfoList, spreadsheetBeatmapInfos);
	res.statusCode = 200;
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(results));
});

server.listen(8080, () => {
	console.log("Server running at http://localhost:8080/");
});
