import type { Page } from "playwright";
import { openOngekiMypageUrl } from "./openOngekiMypageUrl";
import { saveOngekiMypageAuth } from "./saveOngekiMypageAuth";
import { sleep } from "./sleep";
import { getVersionsFromPremiumRecordPage } from "./getAllVersionsFromPremiumRecordPage";
import { scrapeStandardRecordPage } from "./logics/scrapeStandardRecordPage";

export type OngekiMypageMusicInfo = {
	title: string;
	genre: string;
	character: string;
	versionMaster: string | null; // BASIC~MASTER譜面の登場バージョン
	versionLunatic: string | null; // LUNATIC譜面の登場バージョン
};

const GENRE_MASTER_RECORD_PAGE_URL =
	"https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=3";
const GENRE_LUNATIC_RECORD_PAGE_URL =
	"https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=10";
const CHARACTER_MASTER_RECORD_PAGE_URL =
	"https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=3";
const CHARACTER_LUNATIC_RECORD_PAGE_URL =
	"https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=10";

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
		...(await getTitlesFromStandardRecordPage(
			GENRE_MASTER_RECORD_PAGE_URL,
			authFilePath,
		)),
		...(await getTitlesFromStandardRecordPage(
			GENRE_LUNATIC_RECORD_PAGE_URL,
			authFilePath,
		)),
	]);
	const titleCharacterMap = new Map<string, string>([
		...(await getTitlesFromStandardRecordPage(
			CHARACTER_MASTER_RECORD_PAGE_URL,
			authFilePath,
		)),
		...(await getTitlesFromStandardRecordPage(
			CHARACTER_LUNATIC_RECORD_PAGE_URL,
			authFilePath,
		)),
	]);

	// 2. プレミアムコースの楽曲別レコード一覧から、MASTER/LUNATICの登場バージョンを取得
	// 再ログインしないとエラーページに飛びやすい
	await saveOngekiMypageAuth(userName, password, authFilePath);
	const titleMasterVersionMap = new Map<string, string>();
	const titleLunaticVersionMap = new Map<string, string>();
	const versionNameIds = await getVersionsFromPremiumRecordPage(authFilePath);
	for (const [versionName, versionId] of versionNameIds) {
		const threads2 = [
			getTitlesFromPremiumRecordPage(
				`https://ongeki-net.com/ongeki-mobile/record/musicScoreGenre/search/?version=${versionId}&diff=3`,
				authFilePath,
			),
			getTitlesFromPremiumRecordPage(
				`https://ongeki-net.com/ongeki-mobile/record/musicScoreGenre/search/?version=${versionId}&diff=10`,
				authFilePath,
			),
		];
		const [threadResultMaster, threadResultLunatic] =
			await Promise.all(threads2);
		for (const title of threadResultMaster) {
			titleMasterVersionMap.set(title, versionName);
		}
		for (const title of threadResultLunatic) {
			titleLunaticVersionMap.set(title, versionName);
		}
		await sleep(3000);
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
 * スタンダードコースの楽曲別レコードページから、曲タイトルとそれが属するセクション名を取得
 * また各アクセスが3秒間隔になるようにsleepを挟む
 * @param url
 * @param authFilePath
 * @returns 曲タイトルをkey、セクション名をvalueとするMap
 */
async function getTitlesFromStandardRecordPage(
	url: string,
	authFilePath: string,
) {
	const callback = async (page: Page) => {
		console.log(`getTitlesFromStandardRecordPage start: ${url}`);
		const sections = await scrapeStandardRecordPage(await page.content());
		return sections;
	};
	const promises = [
		openOngekiMypageUrl(url, callback, authFilePath),
		sleep(3000),
	];
	const [sections, _] = await Promise.all(promises);
	return sections as Map<string, string>;
}

/**
 * プレミアムコースの楽曲別レコードページから、曲タイトルを取得(ただし"Singularity"は除く)
 * @param url
 * @param authFilePath
 * @returns 曲タイトルの配列
 */
async function getTitlesFromPremiumRecordPage(
	url: string,
	authFilePath: string,
) {
	const callback = async (page: Page) => {
		console.log(`getTitlesFromPremiumRecordPage start: ${url}`);
		// music_labelクラスを含むdivのinnerTextがtitleにあたる
		const xpath = '//div[contains(@class, "music_label")]';
		const divs = page.locator(xpath);
		const divsCount = await divs.count();
		console.log(`${page.url()} div number: ${divsCount}`);
		const titles = await divs.allInnerTexts();
		console.log(`getTitlesFromPremiumRecordPage end: ${url}`);
		console.log(JSON.stringify(titles, null, 0));
		return titles.filter((title) => title !== "Singularity");
	};
	return openOngekiMypageUrl(url, callback, authFilePath);
}
