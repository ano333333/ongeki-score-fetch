import { JSDOM } from "jsdom";

export function scrapePremiumRecordPage(html: string) {
	const dom = new JSDOM(html);
	const document = dom.window.document;

	// music_labelクラスを含むdivのinnerTextがtitleにあたる
	const selector = "div.music_label";
	const divs = document.querySelectorAll(selector);
	// music_labelクラスを含むdivがない場合はエラーページとみなしエラーをthrowする
	if (divs.length === 0) {
		throw new Error();
	}
	const array = Array.from(divs)
		.map((div) => div.textContent)
		.filter((title) => title !== null);
	return array.filter((title) => title !== "");
}
