import http from "node:http";

const server = http.createServer((req, res) => {
	const ENV = process.env.ENV;
	console.log(`ENV: ${ENV}`);
	console.log(`${req.method} ${req.url}`);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain");
	res.end(`Hello, world!\n${req.method} ${req.url}`);
});

server.listen(8080, () => {
	console.log("Server running at http://localhost:8080/");
});
