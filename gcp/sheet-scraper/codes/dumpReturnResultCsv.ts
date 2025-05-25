import { stringify } from "csv-stringify/sync";
import type { ResultCsvRowType } from "./logics/resultCsvRowType";

/**
 * データをcsv文字列に変換する
 * @param results
 * @returns
 */
export function dumpReturnResultCsv(results: Map<string, ResultCsvRowType>) {
	// ReturnResult["constants"]の部分を展開してcsvの行にする
	const convToCsvRow = (result: ResultCsvRowType) => {
		return {
			title: result.title,
			genre: result.genre,
			character: result.character,
			versionMaster: result.versionMaster ?? "",
			versionLunatic: result.versionLunatic ?? "",
			constantBasic: result.constants.BASIC ?? "",
			constantAdvanced: result.constants.ADVANCED ?? "",
			constantExpert: result.constants.EXPERT ?? "",
			constantMaster: result.constants.MASTER ?? "",
			constantLunatic: result.constants.LUNATIC ?? "",
		};
	};
	// csvのヘッダ(title, genre, character, ...)
	const csvResults = Array.from(results.values()).map(convToCsvRow);
	const headers = Object.keys(csvResults[0]);
	return stringify(csvResults, {
		columns: headers.map((header) => ({ key: header })),
		header: true,
	});
}
