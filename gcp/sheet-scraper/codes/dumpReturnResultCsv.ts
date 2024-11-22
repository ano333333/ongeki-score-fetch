import { stringify } from "csv-stringify/sync";
import type { ReturnResult } from "./compileReturnResults";

export function dumpReturnResultCsv(results: ReturnResult[]) {
	// ReturnResult["constants"]の部分を展開してcsvの行にする
	const convToCsvRow = (result: ReturnResult) => {
		const constsMap = {
			BASIC: null as null | number,
			ADVANCED: null as null | number,
			EXPERT: null as null | number,
			MASTER: null as null | number,
			LUNATIC: null as null | number,
		};
		for (const c of result.constants) {
			constsMap[c.difficulty] = c.constant;
		}
		return {
			...result,
			constantBasic: constsMap.BASIC,
			constantAdvanced: constsMap.ADVANCED,
			constantExpert: constsMap.EXPERT,
			constantMaster: constsMap.MASTER,
			constantLunatic: constsMap.LUNATIC,
		};
	};
	// csvのヘッダ(title, genre, character, ...)
	const csvResults = results.map(convToCsvRow);
	const headers = Object.keys(csvResults[0]);
	return stringify(csvResults, {
		columns: headers.map((header) => ({ key: header })),
		header: true,
	});
}
