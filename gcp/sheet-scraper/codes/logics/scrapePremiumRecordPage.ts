import { JSDOM } from "jsdom";

/**
 * プレミアムコースのレコードページのhtmlから、そのページに含まれるタイトルの一覧を取得する
 * @param html
 * @returns string[] タイトルの配列
 */
export function scrapePremiumRecordPage(html: string) {
	if (html.includes("エラー")) {
		throw new Error();
	}

	const dom = new JSDOM(html);
	const document = dom.window.document;

	// music_labelクラスを含むdivのinnerTextがtitleにあたる
	const selector = "div.music_label";
	const divs = document.querySelectorAll(selector);
	const array = Array.from(divs)
		.map((div) => div.textContent)
		.filter((title) => title !== null);
	return array.filter((title) => title !== "");
}
