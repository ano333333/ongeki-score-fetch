import type { StdRecordPageMusicDataType } from "./stdRecordPageMusicDataType";
import { getRecordPageUrl } from "./getRecordPageUrl";
import { scrapeStandardRecordPage } from "./scrapeStandardRecordPage";
import manualMusicDataMaster from "./manualMusicDataMaster.json";
import manualMusicDataLunatic from "./manualMusicDataLunatic.json";

/**
 * スタンダードコースの楽曲別レコード一覧から、曲名ごとのデータを取得
 * @param scraper URLからHTMLを取得する関数
 * @returns Master/LunaticそれぞれのMap<タイトル, データ>
 * @throws ジャンル別ページとキャラクター別ページの両方に記載されていないタイトルがある場合
 */
export async function getStdRecordPageMusicDatas(
	scraper: (url: string) => Promise<string>,
): Promise<{
	master: Map<string, StdRecordPageMusicDataType>;
	lunatic: Map<string, StdRecordPageMusicDataType>;
}> {
	const titleGenreMapMaster = new Map<string, string>([
		...scrapeStandardRecordPage(
			await scraper(getRecordPageUrl(["standard", "genre", "ALL", "MASTER"])),
		),
	]);
	const titleGenreMapLunatic = new Map<string, string>([
		...scrapeStandardRecordPage(
			await scraper(getRecordPageUrl(["standard", "genre", "ALL", "LUNATIC"])),
		),
	]);
	const titleCharacterMapMaster = new Map<string, string>([
		...scrapeStandardRecordPage(
			await scraper(
				getRecordPageUrl(["standard", "character", "ALL", "MASTER"]),
			),
		),
	]);
	const titleCharacterMapLunatic = new Map<string, string>([
		...scrapeStandardRecordPage(
			await scraper(
				getRecordPageUrl(["standard", "character", "ALL", "LUNATIC"]),
			),
		),
	]);

	const resultMapMaster = mergeGenreAndCharacterMap(
		titleGenreMapMaster,
		titleCharacterMapMaster,
	);
	const resultMapLunatic = mergeGenreAndCharacterMap(
		titleGenreMapLunatic,
		titleCharacterMapLunatic,
	);
	resultMapMaster.delete("Singularity");
	resultMapLunatic.delete("Singularity");
	appendManualMusicData(resultMapMaster, manualMusicDataMaster);
	appendManualMusicData(resultMapLunatic, manualMusicDataLunatic);
	return {
		master: resultMapMaster,
		lunatic: resultMapLunatic,
	};
}

function mergeGenreAndCharacterMap(
	titleGenreMap: Map<string, string>,
	titleCharacterMap: Map<string, string>,
) {
	const resultMap = new Map<string, StdRecordPageMusicDataType>();
	for (const [title, genre] of titleGenreMap.entries()) {
		const character = titleCharacterMap.get(title);
		if (!character) {
			throw new Error();
		}
		resultMap.set(title, {
			title,
			genre,
			character,
		});
	}
	for (const title of titleCharacterMap.keys()) {
		if (!resultMap.has(title)) {
			throw new Error();
		}
	}
	return resultMap;
}

function appendManualMusicData(
	resultMap: Map<string, StdRecordPageMusicDataType>,
	manualMusicData: StdRecordPageMusicDataType[],
) {
	for (const data of manualMusicData) {
		resultMap.set(data.title, {
			title: data.title,
			genre: data.genre,
			character: data.character,
		});
	}
}
