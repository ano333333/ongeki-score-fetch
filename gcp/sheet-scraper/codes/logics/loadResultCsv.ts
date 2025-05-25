import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import type { ResultCsvRowType } from "./resultCsvRowType";
import { parse } from "csv-parse";
import type { DifficultyType } from "./difficultyType";

/**
 * 楽曲・譜面データのcsvを読み込む
 * @param path ローカルのcsvファイル相対パス
 * @returns
 */
export async function loadResultCsv(path: string) {
	const readStream = createReadStream(resolve(path));
	const results = new Map<string, ResultCsvRowType>();
	const parser = readStream.pipe(parse({ from_line: 2 }));
	for await (const row of parser) {
		const constants: Record<DifficultyType, number | undefined> = {
			BASIC: convertToUndefinedableNumber(row[5]),
			ADVANCED: convertToUndefinedableNumber(row[6]),
			EXPERT: convertToUndefinedableNumber(row[7]),
			MASTER: convertToUndefinedableNumber(row[8]),
			LUNATIC: convertToUndefinedableNumber(row[9]),
		};
		results.set(row[0] as string, {
			title: row[0] as string,
			genre: row[1] as string,
			character: row[2] as string,
			versionMaster: convertToUndefinedableString(row[3]),
			versionLunatic: convertToUndefinedableString(row[4]),
			constants,
		});
	}
	return results;
}

function convertToUndefinedableString(str: string) {
	if (str === "") {
		return undefined;
	}
	return str;
}

function convertToUndefinedableNumber(str: string) {
	if (str === "") {
		return undefined;
	}
	return Number(str);
}
