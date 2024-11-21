import type { Page } from "playwright";
import { openOngekiMypageUrl } from "./openOngekiMypageUrl";
import { saveOngekiMypageAuth } from "./saveOngekiMypageAuth";

export type OngekiMypageMusicInfo = {
	title: string;
	genre: string;
	character: string;
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
	authFilePath = "./auth.json",
) {
	console.log("getMusicInfoFromOngekiMypage start");
	const userName = process.env.SEGA_USER_NAME;
	const password = process.env.SEGA_PASSWORD;
	if (!userName || !password) {
		throw new Error();
	}
	await saveOngekiMypageAuth(userName, password, authFilePath);

	// ジャンルごとの曲一覧を取得
	console.log("getMusicInfoFromOngekiMypage get genre music info start");

	// 4ページの解析を直列で行うと遅い(レスポンスがtimeoutする)ので、2×2の並列でおこなう
	// (全て一気にPromise.allするとメモリ不足になる)
	const threads = [
		openOngekiMypageUrl(
			GENRE_MASTER_RECORD_PAGE_URL,
			getTitlesWithSectionName,
			authFilePath,
		),
		openOngekiMypageUrl(
			GENRE_LUNATIC_RECORD_PAGE_URL,
			getTitlesWithSectionName,
			authFilePath,
		),

		openOngekiMypageUrl(
			CHARACTER_MASTER_RECORD_PAGE_URL,
			getTitlesWithSectionName,
			authFilePath,
		),
		openOngekiMypageUrl(
			CHARACTER_LUNATIC_RECORD_PAGE_URL,
			getTitlesWithSectionName,
			authFilePath,
		),
	];
	const threadResults = await Promise.all(threads);

	const titleGenreMap = new Map<string, string>([
		...threadResults[0],
		...threadResults[1],
	]);
	// キャラクターごとの曲一覧を取得
	const titleCharacterMap = new Map<string, string>([
		...threadResults[2],
		...threadResults[3],
	]);
	// 両方を合わせてOngekiMypageMusicInfoの配列にする
	const musicInfoList: OngekiMypageMusicInfo[] = [];
	for (const [title, genre] of titleGenreMap) {
		const character = titleCharacterMap.get(title) ?? "";
		musicInfoList.push({ title, genre, character });
	}
	// "Singularity"の3曲は手動で挿入
	musicInfoList.push({
		title: "Singularity -ETIA-",
		genre: "VARIETY",
		character: "光",
	});
	musicInfoList.push({
		title: "Singularity -MJ-",
		genre: "VARIETY",
		character: "九條 楓",
	});
	musicInfoList.push({
		title: "Singularity -technoplanet-",
		genre: "オンゲキ",
		character: "井之原 小星",
	});

	console.log("getMusicInfoFromOngekiMypage end");
	return musicInfoList;
}

/**
 * マイページの曲一覧から、曲タイトルとそれが属するセクション名を取得(ただし"Singularity"は除く)
 * @param page
 * @returns 曲タイトルをkey、セクション名をvalueとするMap
 */
async function getTitlesWithSectionName(page: Page) {
	const musicListDivSelector =
		"body > div.wrapper.main_wrapper.t_c > div.container3";
	const musicListDiv = await page.locator(musicListDivSelector);
	if (musicListDiv === null) {
		throw new Error();
	}

	const allDivsCount = await musicListDiv.locator("> div").count();
	console.log(`${page.url()} div number: ${allDivsCount}`);

	// タイトルをkey、セクション名をvalueとするMap
	const sections = new Map<string, string>();

	/** musicListDivの子をパース
	 * 次のパターンを持つdivを上から順に検索する
	 * 1. <div class="p_5 f_20">: innerTextがセクション名を表す
	 * 2. <div class="basic_btn master_score_back m_10 p_5 t_l">: 中のdivのinnerTextが曲タイトルを表す
	 *  (2.の子孫要素の<div class="music_label p_5 break">のinnerTextが曲タイトルを表す)
	 */
	let currentSectionName: string | null = null;
	let divIndex = 0;
	for (const child of await musicListDiv.locator("> div").all()) {
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
		} else if (
			classList.findIndex((c) => c === "basic_btn") !== -1 &&
			classList.findIndex((c) => c === "m_10") !== -1 &&
			classList.findIndex((c) => c === "p_5") !== -1 &&
			classList.findIndex((c) => c === "t_l") !== -1
		) {
			const titleDiv = await child.locator("div.music_label");
			const title = await titleDiv.innerText();
			if (title && currentSectionName && title !== "Singularity") {
				sections.set(title, currentSectionName);
			}
		}
		divIndex++;
	}
	return sections;
}
