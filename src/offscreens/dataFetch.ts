import { MockUserDataSource } from "../adapters/userDataSource/MockUserDataSource";
import { MockBeatmapDataSource } from "../adapters/beatmapDataSource/mockBeatmapDataSource";
import type { UserDataScoreType } from "../adapters/userDataSource/base";
import type { BeatmapDataType } from "../adapters/beatmapDataSource/base";
import type { OutputTargetDataRowType } from "../adapters/outputTargetType";
import type { ChrExtRuntimeMessageType } from "../messages";

console.log("start offscreenDataFetch.ts");

chrome.runtime.onMessage.addListener((message: ChrExtRuntimeMessageType) => {
	if (message.to !== "offscreenDataFetch") {
		return;
	}
	if (message.type === "start-fetch") {
		fetch();
	}
});

const fetch = async () => {
	console.log("offscreenDataFetch.ts: fetch");
	try {
		const userDataSource = new MockUserDataSource();
		const beatmapDataSource = new MockBeatmapDataSource();

		const logger = async (log: string) => {
			console.log(`offscreenDataFetch.ts: ${log}`);
			await chrome.runtime.sendMessage({
				type: "save-fetch-log",
				from: "offscreenDataFetch",
				to: "backgroundWorker",
				logType: "progress",
				logMessage: log,
			} as ChrExtRuntimeMessageType);
		};

		const userDatas = await userDataSource.getUserData(logger);
		const beatmapDatas = await beatmapDataSource.getBeatmapData(logger);

		const combinedDatas = combineDatas(userDatas, beatmapDatas);
		chrome.runtime.sendMessage({
			type: "fetch-finished",
			from: "offscreenDataFetch",
			to: "backgroundWorker",
			datas: combinedDatas,
		} as ChrExtRuntimeMessageType);
	} catch (error) {
		console.error(`offscreenDataFetch.ts: ${error}`);
		if (typeof error === "string") {
			chrome.runtime.sendMessage({
				type: "fetch-finished",
				from: "offscreenDataFetch",
				to: "backgroundWorker",
				error: error,
			} as ChrExtRuntimeMessageType);
		} else {
			chrome.runtime.sendMessage({
				type: "fetch-finished",
				from: "offscreenDataFetch",
				to: "backgroundWorker",
				error: "不明なエラー",
			} as ChrExtRuntimeMessageType);
		}
	}
};

/**
 * UserDataScoreType[]とBeatmapDataType[]を(name, difficulty)で結合
 * @param userDatas
 * @param beatmapDatas
 * @returns
 */
function combineDatas(
	userDatas: UserDataScoreType[],
	beatmapDatas: BeatmapDataType[],
): OutputTargetDataRowType[] {
	const beatmapDatasNDIndexMap = new Map<[string, string], number>();
	for (const [index, beatmapData] of beatmapDatas.entries()) {
		beatmapDatasNDIndexMap.set(
			[beatmapData.name, beatmapData.difficulty],
			index,
		);
	}
	return userDatas.map((userData) => {
		const name = userData.name;
		const difficulty = userData.difficulty;
		const beatmapDataIndex = beatmapDatasNDIndexMap.get([name, difficulty]);
		const beatmapData = beatmapDataIndex
			? beatmapDatas[beatmapDataIndex]
			: null;
		return {
			name,
			difficulty,
			level: userData.level,
			genre: userData.genre,
			technicalHighScore: userData.technicalHighScore,
			overDamageHighScore: userData.overDamageHighScore,
			battleHighScore: userData.battleHighScore,
			fullBell: userData.fullBell,
			allBreak: userData.allBreak,
			const: beatmapData?.const,
		};
	});
}
