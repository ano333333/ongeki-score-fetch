import type { ResultCsvRowType } from "./resultCsvRowType";
import type { RecordConstsType } from "./recordConstsType";
import type { StdRecordPageMusicDataType } from "./stdRecordPageMusicDataType";

/**
 * 古いCSVから読み出したデータと、新しいデータをマージする
 * @param rowsMap 古いCSVから読み出したデータ
 * @param curMasterMap スタンダードのレコードページから取得したデータ(MASTER)
 * @param curLunaticMap スタンダードのレコードページから取得したデータ(LUNATIC)
 * @param constsMap 譜面定数表のデータ
 * @returns マージしたデータ
 */
export function overwriteResultCsvRowsMap(
	rowsMap: Map<string, ResultCsvRowType>,
	curMasterMap: Map<string, StdRecordPageMusicDataType>,
	curLunaticMap: Map<string, StdRecordPageMusicDataType>,
	curVersionName: string,
	constsMap: Map<string, RecordConstsType>,
) {
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
	let updatedFlag = false;
	// 1. スタンダードのレコードページ(MASTER)のデータをマージする
	for (const [title, { genre, character }] of curMasterMap) {
		if (!rowsMap.get(title)?.versionMaster) {
			rowsMap.set(title, {
				...(rowsMap.get(title) ?? rowDefault),
				title,
				genre,
				character,
				versionMaster: curVersionName,
			});
			console.log(`${title}(Master) added`);
			console.log({ title, genre, character });
			updatedFlag = true;
		}
	}
	// 2. スタンダードのレコードページ(LUNATIC)のデータをマージする
	for (const [title, { genre, character }] of curLunaticMap) {
		if (!rowsMap.get(title)?.versionLunatic) {
			rowsMap.set(title, {
				...(rowsMap.get(title) ?? rowDefault),
				title,
				genre,
				character,
				versionLunatic: curVersionName,
			});
			console.log(`${title}(Lunatic) added`);
			console.log({ title, genre, character });
			updatedFlag = true;
		}
	}
	for (const [title, row] of rowsMap.entries()) {
		// 3. スタンダードのレコードページ(MASTER)から削除されたデータを削除する
		if (row.versionMaster && !curMasterMap.has(title)) {
			row.versionMaster = undefined;
			row.constants.BASIC = undefined;
			row.constants.ADVANCED = undefined;
			row.constants.EXPERT = undefined;
			row.constants.MASTER = undefined;
			console.log(`${title}(Master) deleted`);
			updatedFlag = true;
		}
		// 4. スタンダードのレコードページ(LUNATIC)から削除されたデータを削除する
		if (row.versionLunatic && !curLunaticMap.has(title)) {
			row.versionLunatic = undefined;
			row.constants.LUNATIC = undefined;
			console.log(`${title}(Lunatic) deleted`);
			updatedFlag = true;
		}
		// 5. 両方に無ければMapから削除
		if (row.versionMaster === undefined && row.versionLunatic === undefined) {
			rowsMap.delete(title);
			console.log(`${title}(Master, Lunatic) deleted`);
			updatedFlag = true;
		}
		// 6. 譜面定数表
		const consts = constsMap.get(title);
		if (consts && isConstantsUpdated(row.constants, consts.consts)) {
			row.constants = consts.consts;
			console.log(`${title} Constants updated`);
			updatedFlag = true;
		}
	}
	return updatedFlag;
}

function isConstantsUpdated(
	oldConstants: Record<string, number | undefined>,
	newConstants: Record<string, number | undefined>,
) {
	for (const [key, value] of Object.entries(oldConstants)) {
		if (value !== newConstants[key]) {
			return true;
		}
	}
	return false;
}
