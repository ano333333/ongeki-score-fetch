import type { StdRecordPageMusicDataType } from "./stdRecordPageMusicDataType";
import type { ResultCsvRowType } from "./resultCsvRowType";
import type { RecordConstsType } from "./recordConstsType";

export function createResultCsvRowsMap(
	curMasterMap: Map<string, StdRecordPageMusicDataType>,
	curLunaticMap: Map<string, StdRecordPageMusicDataType>,
	versionsMasterMap: Map<string, string>,
	versionsLunaticMap: Map<string, string>,
	constsMap: Map<string, RecordConstsType>,
) {
	const result = new Map<string, ResultCsvRowType>();
	const rowDefault = {
		versionMaster: undefined,
		versionLunatic: undefined,
		constants: {
			BASIC: undefined,
			ADVANCED: undefined,
			EXPERT: undefined,
			MASTER: undefined,
			LUNATIC: undefined,
		},
	};
	for (const [title, data] of curMasterMap.entries()) {
		result.set(title, {
			...rowDefault,
			title,
			genre: data.genre,
			character: data.character,
			versionMaster: versionsMasterMap.get(title),
		});
	}
	for (const [title, data] of curLunaticMap.entries()) {
		result.set(title, {
			...(result.get(title) ?? rowDefault),
			title,
			genre: data.genre,
			character: data.character,
			versionLunatic: versionsLunaticMap.get(title),
		});
	}
	for (const [title, data] of result.entries()) {
		const consts = constsMap.get(title);
		if (consts) {
			result.set(title, {
				...data,
				constants: consts.consts,
			});
		}
	}
	return result;
}
