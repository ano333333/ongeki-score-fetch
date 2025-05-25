import type { Page } from "playwright";
import { getRecordPageUrl } from "./logics/getRecordPageUrl";
import { openOngekiMypageUrl } from "./openOngekiMypageUrl";
import { saveOngekiMypageAuth } from "./utils/saveOngekiMypageAuth";
import { sleep } from "./utils/sleep";
import { scrapePremiumAllVersions as scrapePremiumAllVersionsLogic } from "./logics/scrapePremiumAllVersions";
import { scrapeStandardRecordPage } from "./logics/scrapeStandardRecordPage";
import { scrapePremiumRecordPage } from "./logics/scrapePremiumRecordPage";

export type OngekiMypageMusicInfo = {
	title: string;
	genre: string;
	character: string;
	versionMaster: string | null; // BASIC~MASTER譜面の登場バージョン
	versionLunatic: string | null; // LUNATIC譜面の登場バージョン
};

const SCRAPE_INTERVAL = 3000;

/**
 * オンゲキマイページから取得可能な、各曲の
 * - タイトル
 * - ジャンル
 * - キャラクター
 * を取得
 */
export async function getMusicInfoFromOngekiMypage(
	authFilePath = "../auth.json",
) {
	console.log("getMusicInfoFromOngekiMypage start");
	const userName = process.env.SEGA_USER_NAME;
	const password = process.env.SEGA_PASSWORD;
	if (!userName || !password) {
		throw new Error();
	}
	await saveOngekiMypageAuth(userName, password, authFilePath);

	// 1. スタンダードコースの楽曲別レコード一覧から、曲名ごとのジャンル/キャラクターを取得
	const titleGenreMap = new Map<string, string>([
		...(await executeLogicWithHtml(
			scrapeStandardRecordPage,
			getRecordPageUrl(["standard", "genre", "ALL", "MASTER"]),
			authFilePath,
		)),
		...(await executeLogicWithHtml(
			scrapeStandardRecordPage,
			getRecordPageUrl(["standard", "genre", "ALL", "LUNATIC"]),
			authFilePath,
		)),
	]);
	const titleCharacterMap = new Map<string, string>([
		...(await executeLogicWithHtml(
			scrapeStandardRecordPage,
			getRecordPageUrl(["standard", "character", "ALL", "MASTER"]),
			authFilePath,
		)),
		...(await executeLogicWithHtml(
			scrapeStandardRecordPage,
			getRecordPageUrl(["standard", "character", "ALL", "LUNATIC"]),
			authFilePath,
		)),
	]);
	titleGenreMap.delete("Singularity");
	titleCharacterMap.delete("Singularity");
	// 2. プレミアムコースの楽曲別レコード一覧から、MASTER/LUNATICの登場バージョンを取得
	// 再ログインしないとエラーページに飛びやすい
	await saveOngekiMypageAuth(userName, password, authFilePath);
	const titleMasterVersionMap = new Map<string, string>();
	const titleLunaticVersionMap = new Map<string, string>();
	const versionNameIds = await executeLogicWithHtml(
		scrapePremiumAllVersionsLogic,
		getRecordPageUrl(["premium", "genre", "ALL", "MASTER"]),
		authFilePath,
	);
	for (const [versionName, versionId] of versionNameIds) {
		const threadResultMaster = await executeLogicWithHtml(
			scrapePremiumRecordPage,
			getRecordPageUrl(["premium", "genre", versionId, "MASTER"]),
			authFilePath,
		);
		const threadResultLunatic = await executeLogicWithHtml(
			scrapePremiumRecordPage,
			getRecordPageUrl(["premium", "genre", versionId, "LUNATIC"]),
			authFilePath,
		);
		threadResultMaster.filter((title) => title !== "Singularity");
		threadResultLunatic.filter((title) => title !== "Singularity");
		for (const title of threadResultMaster) {
			titleMasterVersionMap.set(title, versionName);
		}
		for (const title of threadResultLunatic) {
			titleLunaticVersionMap.set(title, versionName);
		}
	}

	// 3. 1と2を合わせてOngekiMypageMusicInfoの配列にする
	const musicInfoList: OngekiMypageMusicInfo[] = [];
	for (const [title, genre] of titleGenreMap) {
		const character = titleCharacterMap.get(title) ?? "";
		const versionMaster = titleMasterVersionMap.get(title) ?? null;
		const versionLunatic = titleLunaticVersionMap.get(title) ?? null;
		musicInfoList.push({
			title,
			genre,
			character,
			versionMaster,
			versionLunatic,
		});
	}
	// "Singularity"の3曲は手動で挿入
	musicInfoList.push({
		title: "Singularity -ETIA-",
		genre: "VARIETY",
		character: "光",
		versionMaster: "R.E.D.",
		versionLunatic: null,
	});
	musicInfoList.push({
		title: "Singularity -MJ-",
		genre: "VARIETY",
		character: "九條 楓",
		versionMaster: "R.E.D. PLUS",
		versionLunatic: null,
	});
	musicInfoList.push({
		title: "Singularity -technoplanet-",
		genre: "オンゲキ",
		character: "井之原 小星",
		versionMaster: "SUMMER PLUS",
		versionLunatic: null,
	});

	console.log("getMusicInfoFromOngekiMypage end");
	return musicInfoList;
}

/**
 * ページのHTMLを取得し関数に渡す。
 * またページアクセスからこのPromise終了までがSCRAPE_INTERVALミリ秒になるようにsleepを挟む
 * @param url
 * @param authFilePath
 * @returns 曲タイトルをkey、セクション名をvalueとするMap
 */
async function executeLogicWithHtml<T>(
	logic: (html: string) => T,
	url: string,
	authFilePath: string,
) {
	const callback = async (page: Page) => {
		console.log(`executeLogicWithHtml start: ${url}`);
		const html = await page.content();
		const result = await logic(html);
		console.log(`executeLogicWithHtml end: ${url}`);
		return result;
	};
	const promises = [
		openOngekiMypageUrl(url, callback, authFilePath),
		sleep(SCRAPE_INTERVAL),
	];
	const [result, _] = await Promise.all(promises);
	return result as T;
}
