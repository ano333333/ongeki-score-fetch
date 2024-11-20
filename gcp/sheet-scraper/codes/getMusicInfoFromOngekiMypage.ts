import type { Page } from "playwright";
import { openOngekiMypageUrl } from "./openOngekiMypageUrl";
import { saveOngekiMypageAuth } from "./saveOngekiMypageAuth";

export type OngekiMypageMusicInfo = {
	title: string;
	genre: string;
	character: string;
};

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
	const userName = process.env.SEGA_USER_NAME;
	const password = process.env.SEGA_PASSWORD;
	if (!userName || !password) {
		throw new Error();
	}
	await saveOngekiMypageAuth(userName, password, authFilePath);

	// ジャンルごとの曲一覧を取得
	const genreMasterRecordPageUrl =
		"https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=3";
	const genreLunaticRecordPageUrl =
		"https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=10";
	const titleGenreMap = new Map<string, string>([
		...(await openOngekiMypageUrl(
			genreMasterRecordPageUrl,
			getTitlesWithSectionName,
			authFilePath,
		)),
		...(await openOngekiMypageUrl(
			genreLunaticRecordPageUrl,
			getTitlesWithSectionName,
			authFilePath,
		)),
	]);

	// キャラクターごとの曲一覧を取得
	const characterMasterRecordPageUrl =
		"https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=3";
	const characterLunaticRecordPageUrl =
		"https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=10";
	const titleCharacterMap = new Map<string, string>([
		...(await openOngekiMypageUrl(
			characterMasterRecordPageUrl,
			getTitlesWithSectionName,
			authFilePath,
		)),
		...(await openOngekiMypageUrl(
			characterLunaticRecordPageUrl,
			getTitlesWithSectionName,
			authFilePath,
		)),
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

	// タイトルをkey、セクション名をvalueとするMap
	const sections = new Map<string, string>();

	/** musicListDivの子をパース
	 * 次のパターンを持つdivを上から順に検索する
	 * 1. <div class="p_5 f_20">: innerTextがセクション名を表す
	 * 2. <div class="basic_btn master_score_back m_10 p_5 t_l">: 中のdivのinnerTextが曲タイトルを表す
	 *  (2.の子孫要素の<div class="music_label p_5 break">のinnerTextが曲タイトルを表す)
	 */
	let currentSectionName: string | null = null;
	for (const child of await musicListDiv.locator("> div").all()) {
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
	}
	return sections;
}
