import { describe, it, expect } from "@jest/globals";
import type { ResultCsvRowType } from "../../codes/logics/resultCsvRowType";
import type { StdRecordPageMusicDataType } from "../../codes/logics/stdRecordPageMusicDataType";
import type { RecordConstsType } from "../../codes/logics/recordConstsType";
import { overwriteResultCsvRowsMap } from "../../codes/logics/overwriteResultCsvRowsMap";

describe("overwriteResultCsvRowsMap", () => {
	const expectFunctionResultToBe = (
		rowsMap: Record<string, ResultCsvRowType>,
		curMasterMap: Record<string, StdRecordPageMusicDataType>,
		curLunaticMap: Record<string, StdRecordPageMusicDataType>,
		curVersionName: string,
		constsMap: Record<string, RecordConstsType>,
		expectedRowsMap: Record<string, ResultCsvRowType>,
		expectedUpdateFlag: boolean,
	) => {
		const rowsMapMap = new Map(Object.entries(rowsMap));
		const result = overwriteResultCsvRowsMap(
			rowsMapMap,
			new Map(Object.entries(curMasterMap)),
			new Map(Object.entries(curLunaticMap)),
			curVersionName,
			new Map(Object.entries(constsMap)),
		);
		expect(rowsMapMap).toEqual(new Map(Object.entries(expectedRowsMap)));
		expect(result).toEqual(expectedUpdateFlag);
	};

	it("新しい曲が追加された際正しく更新される(Master/定数既知)", () => {
		const rowsMap = {};
		const curMasterMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curLunaticMap = {};
		const curVersionName = "version2";
		const constsMap = {
			title1: {
				title: "title1",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.5,
					LUNATIC: undefined,
				},
			},
		};
		const expected = {
			title1: {
				...curMasterMap.title1,
				versionMaster: "version2",
				versionLunatic: undefined,
				constants: constsMap.title1.consts,
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("新しい曲が追加された際正しく更新される(Master/定数未知)", () => {
		const rowsMap = {};
		const curMasterMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curLunaticMap = {};
		const curVersionName = "version2";
		const constsMap = {};
		const expected = {
			title1: {
				...curMasterMap.title1,
				versionMaster: "version2",
				versionLunatic: undefined,
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: undefined,
				},
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("新しい曲が追加された際正しく更新される(Lunatic/定数既知)", () => {
		const rowsMap = {};
		const curMasterMap = {};
		const curLunaticMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curVersionName = "version2";
		const constsMap = {
			title1: {
				title: "title1",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: 14.0,
				},
			},
		};
		const expected = {
			title1: {
				...curLunaticMap.title1,
				versionMaster: undefined,
				versionLunatic: "version2",
				constants: constsMap.title1.consts,
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("新しい曲が追加された際正しく更新される(Lunatic/定数未知)", () => {
		const rowsMap = {};
		const curMasterMap = {};
		const curLunaticMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curVersionName = "version2";
		const constsMap = {};
		const expected = {
			title1: {
				...curLunaticMap.title1,
				versionMaster: undefined,
				versionLunatic: "version2",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: undefined,
				},
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("既存の曲に譜面が追加された際正しく更新される(Lunatic)", () => {
		const rowsMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
				versionMaster: "version1",
				versionLunatic: undefined,
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.5,
					LUNATIC: undefined,
				},
			},
		};
		const curMasterMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curLunaticMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curVersionName = "version2";
		const constsMap = {
			title1: {
				title: "title1",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.5,
					LUNATIC: 14.0,
				},
			},
		};
		const expected = {
			title1: {
				...rowsMap.title1,
				versionLunatic: "version2",
				constants: {
					...constsMap.title1.consts,
					LUNATIC: 14.0,
				},
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("既存の曲に譜面が追加された際正しく更新される(Master)", () => {
		const rowsMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
				versionMaster: undefined,
				versionLunatic: "version1",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: 14.0,
				},
			},
		};
		const curMasterMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curLunaticMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
			},
		};
		const curVersionName = "version2";
		const constsMap = {
			title1: {
				title: "title1",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.5,
					LUNATIC: 14.0,
				},
			},
		};
		const expected = {
			title1: {
				...rowsMap.title1,
				versionMaster: "version2",
				constants: {
					...constsMap.title1.consts,
					EXPERT: 12.0,
					MASTER: 13.5,
				},
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("譜面定数が変更された際正しく更新される", () => {
		const rowsMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
				versionMaster: "version1",
				versionLunatic: "version1",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.5,
					LUNATIC: 14.0,
				},
			},
			title2: {
				title: "title2",
				genre: "genre2",
				character: "character2",
				versionMaster: "version1",
				versionLunatic: "version1",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: undefined,
				},
			},
		};
		const curMasterMap = {
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
		const curLunaticMap = {
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
		const curVersionName = "version2";
		const constsMap = {
			title1: {
				title: "title1",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.6,
					LUNATIC: 14.0,
				},
			},
			title2: {
				title: "title2",
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.5,
					MASTER: 14.0,
					LUNATIC: 14.5,
				},
			},
		};
		const expected = {
			title1: {
				...rowsMap.title1,
				constants: {
					...constsMap.title1.consts,
				},
			},
			title2: {
				...rowsMap.title2,
				constants: {
					...constsMap.title2.consts,
				},
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("曲が削除された際正しく更新される", () => {
		const rowsMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
				versionMaster: "version1",
				versionLunatic: "version1",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.5,
					LUNATIC: 14.0,
				},
			},
		};
		const curMasterMap = {};
		const curLunaticMap = {};
		const curVersionName = "version2";
		const constsMap = {
			title1: {
				title: "title1",
				consts: rowsMap.title1.constants,
			},
		};
		const expected = {};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			expected,
			true,
		);
	});

	it("変更が無い場合falseが返される", () => {
		const rowsMap = {
			title1: {
				title: "title1",
				genre: "genre1",
				character: "character1",
				versionMaster: "version1",
				versionLunatic: "version1",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.0,
					MASTER: 13.5,
					LUNATIC: 14.0,
				},
			},
			title2: {
				title: "title2",
				genre: "genre2",
				character: "character2",
				versionMaster: "version1",
				versionLunatic: undefined,
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: 12.5,
					MASTER: 14.0,
					LUNATIC: undefined,
				},
			},
			title3: {
				title: "title3",
				genre: "genre3",
				character: "character3",
				versionMaster: undefined,
				versionLunatic: "version1",
				constants: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: 14.5,
				},
			},
		};
		const curMasterMap = {
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
		const curLunaticMap = {
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
		const curVersionName = "version2";
		const constsMap = {
			title1: {
				title: "title1",
				consts: { ...rowsMap.title1.constants },
			},
			title2: {
				title: "title2",
				consts: { ...rowsMap.title2.constants },
			},
			title3: {
				title: "title3",
				consts: { ...rowsMap.title3.constants },
			},
		};

		expectFunctionResultToBe(
			rowsMap,
			curMasterMap,
			curLunaticMap,
			curVersionName,
			constsMap,
			rowsMap,
			false,
		);
	});
});
