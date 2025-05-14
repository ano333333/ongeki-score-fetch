import type { DifficultyType } from "./difficultyType";

const recordPageBaseUrl = "https://ongeki-net.com/ongeki-mobile/record";

/**
 * 楽曲別レコードページのURLを取得する(一部対応)
 * @param prop スタンダード・プレミアム/カテゴリ/細分類/難易度
 * @returns
 */
export function getRecordPageUrl(
	prop:
		| ["standard", "genre", "ALL", DifficultyType]
		| ["standard", "character", "ALL", DifficultyType]
		| ["premium", "genre", number, DifficultyType],
) {
	if (prop[0] === "standard" && prop[1] === "genre") {
		return `${recordPageBaseUrl}/musicGenre/search/?genre=99&diff=${getDifficultyUrlId(prop[3])}`;
	}
	if (prop[0] === "standard" && prop[1] === "character") {
		return `${recordPageBaseUrl}/musicCharacter/search/?chara=99&diff=${getDifficultyUrlId(prop[3])}`;
	}
	return `${recordPageBaseUrl}/musicScoreGenre/search/?version=${prop[2]}&diff=${getDifficultyUrlId(prop[3])}`;
}

function getDifficultyUrlId(
	level: "BASIC" | "ADVANCED" | "EXPERT" | "MASTER" | "LUNATIC",
) {
	return {
		BASIC: 0,
		ADVANCED: 1,
		EXPERT: 2,
		MASTER: 3,
		LUNATIC: 10,
	}[level];
}
