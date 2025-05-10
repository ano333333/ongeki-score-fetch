import { describe, test } from "@jest/globals";
import { scrapeStdRecordCharacterMasterPage } from "../../codes/logics/scrapeStdRecordCharacterMasterPage";
import { checkScrapeStdRecordPage } from "./checkScrapeStdRecordPage";

const htmlPath = "./tests/fixtures/stdRecordCharacterMasterPage.html";
const jsonPath = "./tests/fixtures/stdRecordCharacterMasterPageData.json";

describe("scrapeStdRecordCharacterMasterPage", () => {
	/**
	 * チェック項目
	 * - stdRecordCharacterMasterPage.htmlを読み取った結果が、正解データと一致する
	 */
	test("is equal to expected result with stdRecordCharacterMasterPage.html", () => {
		checkScrapeStdRecordPage(
			htmlPath,
			scrapeStdRecordCharacterMasterPage,
			jsonPath,
		);
	});
});
