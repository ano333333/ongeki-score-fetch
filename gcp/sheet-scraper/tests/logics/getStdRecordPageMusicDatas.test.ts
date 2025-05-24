import { describe, test, expect } from "@jest/globals";
import { getRecordPageUrl } from "../../codes/logics/getRecordPageUrl";
import { getStdRecordPageMusicDatas } from "../../codes/logics/getStdRecordPageMusicDatas";
import { readFile } from "node:fs/promises";

describe("getStdRecordPageMusicDatas", () => {
	const scraper = async (url: string) => {
		let path = "";
		switch (url) {
			case getRecordPageUrl(["standard", "genre", "ALL", "MASTER"]):
				path = "./tests/fixtures/stdRecordGenreMasterPage.html";
				break;
			case getRecordPageUrl(["standard", "character", "ALL", "MASTER"]):
				path = "./tests/fixtures/stdRecordCharacterMasterPage.html";
				break;
			case getRecordPageUrl(["standard", "genre", "ALL", "LUNATIC"]):
				path = "./tests/fixtures/stdRecordGenreLunaticPage.html";
				break;
			case getRecordPageUrl(["standard", "character", "ALL", "LUNATIC"]):
				path = "./tests/fixtures/stdRecordCharacterLunaticPage.html";
				break;
			default:
				throw new Error("Invalid URL");
		}
		return readFile(path, "utf-8");
	};

	const getJsonData = async (path: string) => {
		return JSON.parse(await readFile(path, "utf-8"));
	};

	test("should return the correct data", async () => {
		const data = await getStdRecordPageMusicDatas(scraper);
		const expected = {
			master: new Map(
				Object.entries(
					await getJsonData(
						"./tests/fixtures/getStdRecordPageMusicDatasMasterDatas.json",
					),
				),
			),
			lunatic: new Map(
				Object.entries(
					await getJsonData(
						"./tests/fixtures/getStdRecordPageMusicDatasLunaticDatas.json",
					),
				),
			),
		};
		expect(data).toEqual(expected);
	});

	test("should throw an error if titles are missing", async () => {
		const scraperCharaMissing = async (url: string) => {
			if (
				url === getRecordPageUrl(["standard", "character", "ALL", "MASTER"])
			) {
				return readFile(
					"./tests/fixtures/stdRecordCharacterMasterPageMissing.html",
					"utf-8",
				);
			}
			return scraper(url);
		};
		await expect(
			getStdRecordPageMusicDatas(scraperCharaMissing),
		).rejects.toThrow();
		const scraperGenreMissing = async (url: string) => {
			if (url === getRecordPageUrl(["standard", "genre", "ALL", "MASTER"])) {
				return readFile(
					"./tests/fixtures/stdRecordGenreMasterPageMissing.html",
					"utf-8",
				);
			}
			return scraper(url);
		};
		await expect(
			getStdRecordPageMusicDatas(scraperGenreMissing),
		).rejects.toThrow();
	});
});
