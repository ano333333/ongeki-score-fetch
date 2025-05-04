import { parse } from "csv-parse";
import type { ReturnResult } from "./compileReturnResults";
import { createReadStream } from "node:fs";
import { Storage } from "@google-cloud/storage";
import { resolve } from "node:path";

export async function loadOldCompiledResults(key: string) {
	const sheetStorageName = process.env.SHEET_STORAGE_NAME;
	if (!sheetStorageName) {
		throw new Error("SHEET_STORAGE_NAME is not set");
	}

	const storage = new Storage();
	const file = storage.bucket(sheetStorageName).file(key);
	const [exists] = await file.exists();
	if (!exists) {
		return [];
	}
	await file.download({
		destination: resolve("./result.csv"),
	});

	const readStream = createReadStream(resolve("./result.csv"));
	const results: ReturnResult[] = [];
	const parser = readStream.pipe(parse({ from_line: 2 }));
	for await (const row of parser) {
		const title: string = row[0];
		const genre: string = row[1];
		const character: string = row[2];
		const versionMaster: string | null = row[3] === "" ? null : row[3];
		const versionLunatic: string | null = row[4] === "" ? null : row[4];
		const difficulties = [
			"BASIC",
			"ADVANCED",
			"EXPERT",
			"MASTER",
			"LUNATIC",
		] as const;
		const constants: {
			difficulty: (typeof difficulties)[number];
			constant: number;
		}[] = [];
		for (let i = 5; i < 10; i++) {
			const difficulty = difficulties[i - 5];
			const constant = row[i];
			if (constant !== "") {
				constants.push({ difficulty, constant: Number(constant) });
			}
		}
		results.push({
			title,
			genre,
			character,
			versionMaster,
			versionLunatic,
			constants,
		});
	}
	return results;
}
