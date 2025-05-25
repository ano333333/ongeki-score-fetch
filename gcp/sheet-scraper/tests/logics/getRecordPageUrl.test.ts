import { describe, test, expect } from "@jest/globals";
import { getRecordPageUrl } from "../../codes/logics/getRecordPageUrl";

describe("getRecordGenrePageUrl", () => {
	test("getRecordGenrePageUrl should return correct url", () => {
		expect(getRecordPageUrl(["standard", "genre", "ALL", "BASIC"])).toBe(
			"https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=0",
		);
		expect(getRecordPageUrl(["standard", "genre", "ALL", "ADVANCED"])).toBe(
			"https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=1",
		);
		expect(getRecordPageUrl(["standard", "character", "ALL", "EXPERT"])).toBe(
			"https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=2",
		);
		expect(getRecordPageUrl(["standard", "character", "ALL", "MASTER"])).toBe(
			"https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=3",
		);
		expect(getRecordPageUrl(["premium", "genre", "ALL", "LUNATIC"])).toBe(
			"https://ongeki-net.com/ongeki-mobile/record/musicScoreGenre/search/?version=99&diff=10",
		);
		expect(getRecordPageUrl(["premium", "genre", 1000, "MASTER"])).toBe(
			"https://ongeki-net.com/ongeki-mobile/record/musicScoreGenre/search/?version=1000&diff=3",
		);
	});
});
