import { describe, it, expect } from "@jest/globals";
import { createResultCsvRowsMap } from "../../codes/logics/createResultCsvRowsMap";
import type { RecordConstsType } from "../../codes/logics/recordConstsType";

describe("createResultCsvRowsMap", () => {
	it("should create a result csv rows map", () => {
		const curMasterRecords = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
			title2: {
				title: "title2",
				genre: "genre2",
				character: "character2",
			},
		};
		const curLunaticRecords = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
			title3: {
				title: "title3",
				genre: "genre3",
				character: "character3",
			},
		};
		const versionsMasterRecords = {
			title1: "version1",
			title2: "version2",
		};
		const versionsLunaticRecords = {
			title1: "version1",
			title3: "version3",
		};
		const constsRecords = {
			title1: {
				title: "title1",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.5,
					MASTER: 14.0,
					LUNATIC: 15.0,
				},
			},
			title2: {
				title: "title2",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 13.0,
					MASTER: 14.5,
					LUNATIC: undefined,
				},
			},
			title3: {
				title: "title3",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: 15.2,
				},
			},
		};
		const expected = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
				versionMaster: "version1",
				versionLunatic: "version1",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.5,
					MASTER: 14.0,
					LUNATIC: 15.0,
				},
			},
			title2: {
				title: "title2",
				genre: "genre2",
				character: "character2",
				versionMaster: "version2",
				versionLunatic: undefined,
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 13.0,
					MASTER: 14.5,
					LUNATIC: undefined,
				},
			},
			title3: {
				title: "title3",
				genre: "genre3",
				character: "character3",
				versionMaster: undefined,
				versionLunatic: "version3",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: 15.2,
				},
			},
		};
		const curMasterMap = new Map(Object.entries(curMasterRecords));
		const curLunaticMap = new Map(Object.entries(curLunaticRecords));
		const versionsMasterMap = new Map(Object.entries(versionsMasterRecords));
		const versionsLunaticMap = new Map(Object.entries(versionsLunaticRecords));
		const constsMap = new Map<string, RecordConstsType>(
			Object.entries(constsRecords),
		);
		const result = createResultCsvRowsMap(
			curMasterMap,
			curLunaticMap,
			versionsMasterMap,
			versionsLunaticMap,
			constsMap,
		);
		expect(result).toEqual(new Map(Object.entries(expected)));
	});
});
