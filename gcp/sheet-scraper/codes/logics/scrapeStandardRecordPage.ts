import { JSDOM } from "jsdom";

/**
 * 楽曲別レコード・カテゴリ別ページ(`https://ongeki-net.com/ongeki-mobile/record/musicGenre/*`)から、セクション名とそれに属する曲タイトルを取得
 *
 * **同名の曲がある場合、後の曲で上書きされる**
 * @param html
 * @returns 曲タイトルをkey、セクション名をvalueとするMap
 */
export function scrapeStandardRecordPage(html: string): Map<string, string> {
	const dom = new JSDOM(html);
	const document = dom.window.document;

	const musicListDivSelector = "div.container3";
	const musicListDiv = document.querySelector(musicListDivSelector);
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
	const sectionOrTitleDivsSelector = "div.p_5.f_20, div.music_label";
	const sectionOrTitleDivs = musicListDiv.querySelectorAll(
		sectionOrTitleDivsSelector,
	);
	// sectionOrTitleDivsSelectorにマッチする要素が無ければエラー画面と考えスロー
	if (sectionOrTitleDivs.length === 0) {
		throw new Error();
	}
	let currentSectionName: string | null = null;
	let divIndex = 0;
	for (const child of sectionOrTitleDivs) {
		const classList = child.classList;
		if (classList.contains("p_5") && classList.contains("f_20")) {
			const sectionName = child.textContent;
			if (sectionName) {
				currentSectionName = sectionName;
			}
		} else if (classList.contains("music_label")) {
			const title = child.textContent;
			if (title && currentSectionName && title !== "Singularity") {
				sections.set(title, currentSectionName);
			}
		}
		divIndex++;
	}
	return sections;
}
