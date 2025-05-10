import { describe, test } from "@jest/globals";
import { scrapeStdRecordCharacterLunaticPage } from "../../codes/logics/scrapeStdRecordCharacterLunaticPage";
import { checkScrapeStdRecordPage } from "./checkScrapeStdRecordPage";

const htmlPath = "./tests/fixtures/stdRecordCharacterLunaticPage.html";
const jsonPath = "./tests/fixtures/stdRecordCharacterLunaticPageData.json";

describe("scrapeStdRecordCharacterLunaticPage", () => {
	/**
	 * チェック項目
	 * - stdRecordCharacterLunaticPage.htmlを読み取った結果が、正解データと一致する
	 */
	test("is equal to expected result with stdRecordCharacterLunaticPage.html", () => {
		checkScrapeStdRecordPage(
			htmlPath,
			scrapeStdRecordCharacterLunaticPage,
			jsonPath,
		);
	});
});
