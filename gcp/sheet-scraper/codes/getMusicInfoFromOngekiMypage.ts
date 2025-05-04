import type { Page } from "playwright";
import { openOngekiMypageUrl } from "./openOngekiMypageUrl";
import { saveOngekiMypageAuth } from "./saveOngekiMypageAuth";
import { sleep } from "./sleep";
import { getVersionsFromPremiumRecordPage } from "./getAllVersionsFromPremiumRecordPage";

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

	console.log("getMusicInfoFromOngekiMypage get music info start");

	// 1. スタンダードコースの楽曲別レコード一覧から、曲名ごとのジャンル/キャラクターを取得
	// 4ページの解析を直列で行うと遅い(レスポンスがtimeoutする)ので、並列でおこなう
	const threads1 = [
		getTitlesFromStandardRecordPage(GENRE_MASTER_RECORD_PAGE_URL, authFilePath),
		getTitlesFromStandardRecordPage(
			GENRE_LUNATIC_RECORD_PAGE_URL,
			authFilePath,
		),
		getTitlesFromStandardRecordPage(
			CHARACTER_MASTER_RECORD_PAGE_URL,
			authFilePath,
		),
		getTitlesFromStandardRecordPage(
			CHARACTER_LUNATIC_RECORD_PAGE_URL,
			authFilePath,
		),
	];
	const threadResults = await Promise.all(threads1);

	const titleGenreMap = new Map<string, string>([
		...threadResults[0],
		...threadResults[1],
	]);
	// キャラクターごとの曲一覧を取得
	const titleCharacterMap = new Map<string, string>([
		...threadResults[2],
		...threadResults[3],
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
 * スタンダードコースの楽曲別レコードページから、曲タイトルとそれが属するセクション名を取得(ただし"Singularity"は除く)
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
		const musicListDivSelector =
			"body > div.wrapper.main_wrapper.t_c > div.container3";
		const musicListDiv = await page.locator(musicListDivSelector);
		if (musicListDiv === null) {
			throw new Error();
		}

		// タイトルをkey、セクション名をvalueとするMap
		const sections = new Map<string, string>();

		/** musicListDivの子をパース
		 * 次のパターンを持つdivを上から順に検索する
		 * 1. <div class="p_5 f_20">: innerTextがセクション名を表す
		 * 2. <div class="basic_btn master_score_back m_10 p_5 t_l">: 中のdivのinnerTextが曲タイトルを表す
		 *  (2.の子孫要素の<div class="music_label p_5 break">のinnerTextが曲タイトルを表す)
		 */
		const sectinoOrTitleDivsLocator = musicListDiv.locator(
			"//div[@class='p_5 f_20' or contains(@class, 'music_label')]",
		);
		const allDivsCount = await sectinoOrTitleDivsLocator.count();
		console.log(`${page.url()} div number: ${allDivsCount}`);
		let currentSectionName: string | null = null;
		let divIndex = 0;
		for (const child of await sectinoOrTitleDivsLocator.all()) {
			if (divIndex % 100 === 0) {
				console.log(`${page.url()} div index: ${divIndex}/${allDivsCount}`);
			}
			const tagName = await child.evaluate((el) => el.tagName);
			if (tagName !== "DIV") {
				continue;
			}
			const classList = (await child.getAttribute("class"))?.split(" ");
			if (!classList) {
				continue;
			}
			if (
				classList.findIndex((c) => c === "p_5") !== -1 &&
				classList.findIndex((c) => c === "f_20") !== -1
			) {
				const sectionName = await child.innerText();
				if (sectionName) {
					currentSectionName = sectionName;
				}
			} else if (classList.findIndex((c) => c === "music_label") !== -1) {
				const title = await child.innerText();
				if (title && currentSectionName && title !== "Singularity") {
					sections.set(title, currentSectionName);
				}
			}
			divIndex++;
		}
		console.log(`getTitlesFromStandardRecordPage end: ${url}`);
		console.log(JSON.stringify(sections, null, 0));
		return sections;
	};
	return openOngekiMypageUrl(url, callback, authFilePath);
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
