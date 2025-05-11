import { JSDOM } from "jsdom";

/**
 * プレミアムコースの楽曲レコードページから、全バージョンの名称とバージョンIDを取得する
 * @param html
 * @returns バージョン名とバージョンIDのタプルの配列
 */
export function scrapePremiumAllVersions(html: string) {
	const versionNameIds = new Array<[string, number]>();

	const dom = new JSDOM(html);
	const document = dom.window.document;

	const selector = "select[name='version']";
	const select = document.querySelector(selector);
	if (select === null) {
		throw new Error();
	}
	const options = select.children;
	for (const option of options) {
		const value = option.getAttribute("value");
		const textContent = option.textContent;
		if (!value || !textContent) {
			throw new Error();
		}
		if (value === "99") {
			continue;
		}
		versionNameIds.push([textContent, Number.parseInt(value)]);
	}
	return versionNameIds;
}
