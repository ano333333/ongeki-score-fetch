import type { OngekiMypageMusicInfo } from "./getMusicInfoFromOngekiMypage";
import type { SpreadsheetBeatmapInfo } from "./getSpreadsheetBeatmapInfos";

export type ReturnResult = {
	title: string; // title
	genre: string; // genre
	character: string; // character
	versionMaster: string | null; // MASTERの登場バージョン
	versionLunatic: string | null; // LUNATICの登場バージョン
	constants: Array<{
		difficulty: "BASIC" | "ADVANCED" | "EXPERT" | "MASTER" | "LUNATIC"; // BASIC, ADVANCED, EXPERT, MASTER, LUNATIC
		constant: number; // constant
	}>;
};

export function compileReturnResults(
	mypageInfos: OngekiMypageMusicInfo[],
	beatmapInfos: SpreadsheetBeatmapInfo[],
) {
	const titleConstantsMap = new Map<
		string,
		Array<{
			difficulty: SpreadsheetBeatmapInfo["difficulty"];
			constant: number;
		}>
	>();
	for (const info of beatmapInfos) {
		if (!titleConstantsMap.has(info.title)) {
			titleConstantsMap.set(info.title, []);
		}
		titleConstantsMap.get(info.title)?.push({
			difficulty: info.difficulty,
			constant: info.constant,
		});
	}

	const results: ReturnResult[] = [];
	for (const info of mypageInfos) {
		const constants = titleConstantsMap.get(info.title) ?? [];
		// constantsを"BASIC"->"ADVANCED"->"EXPERT"->"MASTER"->"LUNATIC"の順でソート
		constants.sort((a, b) => {
			const order = ["BASIC", "ADVANCED", "EXPERT", "MASTER", "LUNATIC"];
			return order.indexOf(a.difficulty) - order.indexOf(b.difficulty);
		});
		results.push({
			title: info.title,
			genre: info.genre,
			character: info.character,
			versionMaster: info.versionMaster,
			versionLunatic: info.versionLunatic,
			constants,
		});
	}

	return results;
}
