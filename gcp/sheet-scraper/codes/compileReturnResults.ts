import type { OngekiMypageMusicInfo } from "./getMusicInfoFromOngekiMypage";
import type { SpreadsheetBeatmapInfo } from "./getSpreadsheetBeatmapInfos";

export type ReturnResult = {
	t: string; // title
	g: string; // genre
	ch: string; // character
	cos: Array<{
		d: 0 | 1 | 2 | 3 | 10; // BASIC, ADVANCED, EXPERT, MASTER, LUNATIC
		c: number; // constant
	}>;
};

const difficultyMap = {
	BASIC: 0 as const,
	ADVANCED: 1 as const,
	EXPERT: 2 as const,
	MASTER: 3 as const,
	LUNATIC: 10 as const,
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
		const cos: ReturnResult["cos"] = constants.map((constant) => ({
			d: difficultyMap[constant.difficulty],
			c: constant.constant,
		}));
		results.push({
			t: info.title,
			g: info.genre,
			ch: info.character,
			cos,
		});
	}

	return results;
}
