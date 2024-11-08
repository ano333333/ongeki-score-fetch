import http from "node:http";
import { getMusicInfoFromOngekiMypage } from "./getMusicInfoFromOngekiMypage";
const server = http.createServer(async (req, res) => {
	const ENV = process.env.ENV;
	console.log(`ENV: ${ENV}`);
	console.log(`${req.method} ${req.url}`);
	const musicInfoList = await getMusicInfoFromOngekiMypage();
	res.statusCode = 200;
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(musicInfoList));
});

server.listen(8080, () => {
	console.log("Server running at http://localhost:8080/");
});
