import { readFileSync } from "node:fs";
import { expect } from "@jest/globals";

/**
 * scrapeStdRecord(Genre|Character)(Lunatic|Master)Page関数に対して以下をチェックする
 * - htmlを読み取った結果と正解データが一致する
 * @param htmlPath
 * @param functor
 * @param dataPath
 */
export function checkScrapeStdRecordPage(
	htmlPath: string,
	functor: (html: string) => Map<string, string>,
	dataPath: string,
) {
	const html = readFileSync(htmlPath, "utf-8");
	const result = functor(html);
	const dataObj: Record<string, string> = JSON.parse(
		readFileSync(dataPath, "utf-8"),
	);
	const expectedResult = new Map(Object.entries(dataObj));
	expect(result).toEqual(expectedResult);
}
