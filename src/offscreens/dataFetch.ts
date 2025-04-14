import type { UserDataScoreType } from "../adapters/userDataSource/base";
import type {
	BeatmapDataDifficultyType,
	BeatmapDataType,
} from "../adapters/beatmapDataSource/base";
import type { OutputTargetDataRowType } from "../adapters/outputTargetType";
import type { ChrExtRuntimeMessageType } from "../messages";
import { OngekiMypageUserDataSource } from "../adapters/userDataSource/ongekiMypageUserDataSource";
import { OngekiScoreLogBeatmapDataSource } from "../adapters/beatmapDataSource/ongekiScoreLogBeatmapDataSource";

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
		const userDataSource = new OngekiMypageUserDataSource();
		const beatmapDataSource = new OngekiScoreLogBeatmapDataSource();

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

		let userDatas: UserDataScoreType[] = [];
		try {
			userDatas = await userDataSource.getUserData(logger);
		} catch (e) {
			throw "ユーザーデータ取得中にエラーが発生しました。再ログインしてください。";
		}
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
	// キーはname
	const beatmapNameDifficultyMap = new Map<
		string,
		Map<BeatmapDataDifficultyType, BeatmapDataType>
	>();
	for (const beatmapData of beatmapDatas) {
		const m = beatmapNameDifficultyMap.get(beatmapData.name);
		if (!m) {
			beatmapNameDifficultyMap.set(beatmapData.name, new Map());
		}
		beatmapNameDifficultyMap
			.get(beatmapData.name)
			?.set(beatmapData.difficulty, beatmapData);
	}
	console.log(beatmapNameDifficultyMap);
	return userDatas.map((userData) => {
		const name = userData.name;
		const difficulty = userData.difficulty;
		const beatmapData = beatmapNameDifficultyMap.get(name)?.get(difficulty);
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
			platinumHighScore: userData.platinumHighScore,
			platinumStar: userData.platinumStar,
			platinumMaxScore: userData.platinumMaxScore,
		};
	});
}
