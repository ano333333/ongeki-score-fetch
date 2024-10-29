import type {
	BeatmapDataDifficultyType,
	BeatmapDataType,
	IBeatmapDataSource,
} from "./base";

export class OngekiScoreLogBeatmapDataSource implements IBeatmapDataSource {
	async getBeatmapData(
		logger: (message: string) => Promise<void>,
	): Promise<BeatmapDataType[]> {
		const url = "https://ongeki-score.net/music";
		const response = await fetch(url);
		const html = await response.text();
		const scoreConsts = await this.parseScoreConstHTML(html);
		console.log(scoreConsts);
		await logger("譜面情報取得完了");
		return scoreConsts;
	}

	/**
	 * ongeki-score.net/musicのHTMLを受け取り、譜面定数データを返す
	 * @param html
	 * @returns
	 */
	private async parseScoreConstHTML(html: string) {
		const domparser = new DOMParser();
		const doc = domparser.parseFromString(html, "text/html");
		if (doc.getElementsByTagName("parseerror").length) {
			throw new Error("HTML Parse Error");
		}
		//譜面定数表のtable要素のtbody要素を取得
		const tbody_xpath = "/html/body/main/div[1]/article/div[2]/table/tbody";
		const tbody = doc.evaluate(
			tbody_xpath,
			doc,
			null,
			XPathResult.FIRST_ORDERED_NODE_TYPE,
			null,
		).singleNodeValue;
		if (tbody === null) {
			throw new Error("HTML Parse Error");
		}
		/*tbodyに含まれるtr要素の構成は、
		 * tr
		 * - td
		 *  - span
		 *  - a(innerText=name)
		 * - td(innerTextのUpperCast=difficulity)
		 * - td
		 * - td(innerText=const)
		 * - td
		 * - td
		 */
		const trs = tbody.childNodes;
		const datas: BeatmapDataType[] = [];
		for (const tr of trs) {
			if (tr instanceof HTMLTableRowElement) {
				const tds = tr.getElementsByTagName("td");
				const name = tds[0].getElementsByTagName("a")[0].textContent || "";
				const difficulty = tds[1].textContent?.toUpperCase() || "";
				const constStr = tds[3].textContent || "";
				const constNum = Number.parseFloat(constStr);
				datas.push({
					name,
					difficulty: difficulty as BeatmapDataDifficultyType,
					const: constNum,
				});
			}
		}
		return datas;
	}
}
