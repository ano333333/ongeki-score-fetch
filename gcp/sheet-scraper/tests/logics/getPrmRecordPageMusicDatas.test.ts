import { describe, test, expect } from "@jest/globals";
import { getRecordPageUrl } from "../../codes/logics/getRecordPageUrl";
import { getPrmRecordPageMusicDatas } from "../../codes/logics/getPrmRecordPageMusicDatas";
import { readFile } from "node:fs/promises";

describe("getPrmRecordPageMusicDatas", () => {
	const scraper = async (url: string) => {
		let path = "";
		if (url === getRecordPageUrl(["premium", "genre", "ALL", "MASTER"])) {
			path = "./tests/fixtures/prmRecordGenreMasterPage.html";
		} else {
			const urlObj = new URL(url);
			const versionIdStr = urlObj.searchParams.get("version");
			if (versionIdStr) {
				const versionId = Number.parseInt(versionIdStr);
				const isMaster = urlObj.searchParams.get("diff") === "3";
				path = `./tests/fixtures/prmRecordGenre${isMaster ? "Master" : "Lunatic"}Ver${versionId}Page.html`;
			}
		}
		return readFile(path, "utf-8");
	};

	const getJsonData = async (path: string) => {
		return JSON.parse(await readFile(path, "utf-8"));
	};

	test("should return the correct data", async () => {
		const data = await getPrmRecordPageMusicDatas(scraper);
		const expected = {
			master: new Map(
				Object.entries(
					await getJsonData(
						"./tests/fixtures/getPrmRecordPageMusicDatasMasterDatas.json",
					),
				),
			),
			lunatic: new Map(
				Object.entries(
					await getJsonData(
						"./tests/fixtures/getPrmRecordPageMusicDatasLunaticDatas.json",
					),
				),
			),
		};
		expect(data).toEqual(expected);
	});
});
