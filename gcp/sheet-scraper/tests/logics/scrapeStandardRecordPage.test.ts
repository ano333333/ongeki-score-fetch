import { readFileSync } from "node:fs";
import { expect, describe, test } from "@jest/globals";
import { scrapeStandardRecordPage } from "../../codes/logics/scrapeStandardRecordPage";

/**
 * scrapeStandardRecordPage関数に対して以下をチェックする
 * - htmlを読み取った結果と正解データが一致する
 * @param htmlPath
 * @param dataPath
 */
function checkScrapeStdRecordPage(htmlPath: string, dataPath: string) {
	const html = readFileSync(htmlPath, "utf-8");
	const result = scrapeStandardRecordPage(html);
	const dataObj: Record<string, string> = JSON.parse(
		readFileSync(dataPath, "utf-8"),
	);
	const expectedResult = new Map(Object.entries(dataObj));
	expect(result).toEqual(expectedResult);
}

describe("scrapeStandardRecordPage", () => {
	test("should scrape standard record page genre/lunatic correctly", () => {
		checkScrapeStdRecordPage(
			"./tests/fixtures/stdRecordGenreLunaticPage.html",
			"./tests/fixtures/stdRecordGenreLunaticPageData.json",
		);
	});

	test("should scrape standard record page genre/master correctly", () => {
		checkScrapeStdRecordPage(
			"./tests/fixtures/stdRecordGenreMasterPage.html",
			"./tests/fixtures/stdRecordGenreMasterPageData.json",
		);
	});

	test("should scrape standard record page character/lunatic correctly", () => {
		checkScrapeStdRecordPage(
			"./tests/fixtures/stdRecordCharacterLunaticPage.html",
			"./tests/fixtures/stdRecordCharacterLunaticPageData.json",
		);
	});

	test("should scrape standard record page character/master correctly", () => {
		checkScrapeStdRecordPage(
			"./tests/fixtures/stdRecordCharacterMasterPage.html",
			"./tests/fixtures/stdRecordCharacterMasterPageData.json",
		);
	});
});
