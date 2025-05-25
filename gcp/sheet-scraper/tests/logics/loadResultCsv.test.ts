import { describe, test, expect } from "@jest/globals";
import { loadResultCsv } from "../../codes/logics/loadResultCsv";
import { readFileSync } from "node:fs";

describe("loadResultCsv", () => {
	test("should load result csv correctly", async () => {
		const result = await loadResultCsv(
			"./tests/fixtures/loadResultCsvData.csv",
		);
		const expected = new Map(
			Object.entries(
				convertNullToUndefined(
					JSON.parse(
						readFileSync("./tests/fixtures/loadResultCsvData.json", "utf-8"),
					),
				),
			),
		);
		expect(result).toEqual(expected);
	});
});

function convertNullToUndefined(obj: Record<string, unknown>) {
	for (const key in obj) {
		if (obj[key] === null) {
			obj[key] = undefined;
		} else if (typeof obj[key] === "object") {
			convertNullToUndefined(obj[key] as Record<string, unknown>);
		}
	}
	return obj;
}
