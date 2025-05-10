import { describe, test } from "@jest/globals";
import { scrapeStdRecordGenreMasterPage } from "../../codes/logics/scrapeStdRecordGenreMasterPage";
import { checkScrapeStdRecordPage } from "./checkScrapeStdRecordPage";

const htmlPath = "./tests/fixtures/stdRecordGenreMasterPage.html";
const jsonPath = "./tests/fixtures/stdRecordGenreMasterPageData.json";

describe("scrapeStdRecordGenreMasterPage", () => {
	/**
	 * チェック項目
	 * - stdRecordGenreMasterPage.htmlを読み取った結果が、正解データと一致する
	 */
	test("is equal to expected result with stdRecordGenreMasterPage.html", () => {
		checkScrapeStdRecordPage(
			htmlPath,
			scrapeStdRecordGenreMasterPage,
			jsonPath,
		);
	});
});
