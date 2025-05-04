import fs from "node:fs";
import { resolve } from "node:path";

export function removeOngekiMypageAuth(authFilePath = "../auth.json") {
	const absAuthFilePath = resolve(__dirname, authFilePath);
	if (fs.existsSync(absAuthFilePath)) {
		fs.rmSync(absAuthFilePath);
	}
}
