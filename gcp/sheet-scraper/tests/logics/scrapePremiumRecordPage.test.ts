import { readFileSync } from "node:fs";
import { expect, describe, test } from "@jest/globals";
import { scrapePremiumRecordPage } from "../../codes/logics/scrapePremiumRecordPage";

/**
 * scrapePremiumRecordPage関数に対して以下をチェックする
 * - htmlを読み取った結果と正解データが一致する
 * @param htmlPath
 * @param dataPath
 */
function checkScrapePrmRecordPage(htmlPath: string, dataPath: string) {
	const html = readFileSync(htmlPath, "utf-8");
	const result = scrapePremiumRecordPage(html);
	const dataObj: string[] = JSON.parse(readFileSync(dataPath, "utf-8"));
	expect(result).toEqual(dataObj);
}

describe("scrapePremiumRecordPage", () => {
	test("should scrape premium record page genre/master correctly", () => {
		checkScrapePrmRecordPage(
			"./tests/fixtures/prmRecordGenreMasterPage.html",
			"./tests/fixtures/prmRecordGenreMasterPageData.json",
		);
	});

	test("should scrape premium record page genre/lunatic correctly", () => {
		checkScrapePrmRecordPage(
			"./tests/fixtures/prmRecordGenreLunaticPage.html",
			"./tests/fixtures/prmRecordGenreLunaticPageData.json",
		);
	});

	test("should throw error when scraping error page(no music_label class)", () => {
		expect(() =>
			scrapePremiumRecordPage(
				readFileSync("./tests/fixtures/error.html", "utf-8"),
			),
		).toThrow();
	});
});
