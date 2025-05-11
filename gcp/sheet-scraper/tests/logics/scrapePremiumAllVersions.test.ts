import { describe, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { scrapePremiumAllVersions } from "../../codes/logics/scrapePremiumAllVersions";

describe("scrapePremiumAllVersions", () => {
	test("should scrape premium record page correctly", () => {
		const html = readFileSync("./tests/fixtures/prmRecordGenre.html", "utf-8");
		const result = scrapePremiumAllVersions(html);
		const expectedResult = JSON.parse(
			readFileSync("./tests/fixtures/prmRecordGenreData.json", "utf-8"),
		);
		expect(result).toEqual(expectedResult);
	});

	test("should throw error when scraping error page", () => {
		expect(() =>
			scrapePremiumAllVersions(
				readFileSync("./tests/fixtures/error.html", "utf-8"),
			),
		).toThrow();
	});

	test("should throw error when html contains invalid option", () => {
		const htmlWithNoValueOption = `<html><body><select name="version"><option version="99">全バージョン</option><option>version1</option></select></body></html>`;
		expect(() => scrapePremiumAllVersions(htmlWithNoValueOption)).toThrow();

		const htmlWithNoVersionNameOption = `<html><body><select name="version"><option value="99">全バージョン</option><option value="1000"></option></select></body></html>`;
		expect(() =>
			scrapePremiumAllVersions(htmlWithNoVersionNameOption),
		).toThrow();
	});
});
