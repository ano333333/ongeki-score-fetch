import { describe, test } from "@jest/globals";
import { scrapeStdRecordGenreLunaticPage } from "../../codes/logics/scrapeStdRecordGenreLunaticPage";
import { checkScrapeStdRecordPage } from "./checkScrapeStdRecordPage";

const htmlPath = "./tests/fixtures/stdRecordGenreLunaticPage.html";
const jsonPath = "./tests/fixtures/stdRecordGenreLunaticPageData.json";

describe("scrapeStdRecordGenreLunaticPage", () => {
	/**
	 * チェック項目
	 * - stdRecordGenreLunaticPage.htmlを読み取った結果が、正解データと一致する
	 */
	test("is equal to expected result with stdRecordGenreLunaticPage.html", () => {
		checkScrapeStdRecordPage(
			htmlPath,
			scrapeStdRecordGenreLunaticPage,
			jsonPath,
		);
	});
});
