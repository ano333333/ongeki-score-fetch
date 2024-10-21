import type { LocalStorage, LocalStorageType } from "../adapters/localStorage";
import type { IOutputTargetFactory } from "../adapters/outputTargetFactory/base";
import type { OutputTargetDataRowType } from "../adapters/outputTargetType";
import type {
	BeatmapDataType,
	IBeatmapDataSource,
} from "../adapters/beatmapDataSource/base";
import type {
	IUserDataSource,
	UserDataScoreType,
} from "../adapters/userDataSource/base";

export class PopupController {
	constructor(
		private readonly userDataSource: IUserDataSource,
		private readonly scoreDataSource: IBeatmapDataSource,
		private readonly localStorage: LocalStorage,
		private readonly outputTargetFactory: IOutputTargetFactory,
		progressesListener: (progress: LocalStorageType["progresses"]) => void,
	) {
		this.localStorage.addProgressesListener(progressesListener);
		this.localStorage
			.validateRawLocalStorage()
			.then(() => this.judgeProgressTimeout);
	}

	async isUserDataFetchable() {
		const u = await this.userDataSource.isUserDataFetchable();
		if (u !== true) {
			return u;
		}

		// 最後の進捗メッセージが"progress"タイプだったら、作業中と判断
		const lastProgress = (await this.localStorage.getProgresses()).at(-1);
		if (lastProgress && lastProgress.type === "progress") {
			return "データ取得がまだ終了していません";
		}
		return true;
	}

	async getLocalStorageProgresses() {
		return await this.localStorage.getProgresses();
	}

	async fetchAndOutputData() {
		const logger = async (message: string) => {
			await this.localStorage.appendProgresses({
				createdAt: Date.now(),
				type: "progress",
				message,
			});
		};

		await this.localStorage.clearProgresses();
		await this.localStorage.appendProgresses({
			createdAt: Date.now(),
			type: "progress",
			message: "開始",
		});

		const userDatas = await this.userDataSource.getUserData(logger);
		const beatmapDatas = await this.scoreDataSource.getBeatmapData(logger);

		const outputTargetDatasRows = await this.combineDatas(
			userDatas,
			beatmapDatas,
		);

		await this.outputDatas(outputTargetDatasRows, logger);

		await this.localStorage.appendProgresses({
			createdAt: Date.now(),
			type: "finish",
			message: "終了",
		});
	}

	/**
	 * ローカルストレージのprogressesをチェックし、開始時刻が現在より10分以上前ならばタイムアウトエラーを追加する
	 */
	private async judgeProgressTimeout() {
		const progress = (await this.localStorage.getProgresses()).at(0);
		if (progress && progress.createdAt < Date.now() - 10 * 60 * 1000) {
			await this.localStorage.appendProgresses({
				createdAt: Date.now(),
				type: "error",
				message: "タイムアウト",
			});
		}
	}

	/**
	 * UserDataScoreType[]とBeatmapDataType[]を(name, difficulty)で結合
	 * @param userDatas
	 * @param beatmapDatas
	 * @returns
	 */
	private async combineDatas(
		userDatas: UserDataScoreType[],
		beatmapDatas: BeatmapDataType[],
	) {
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

	/**
	 * output
	 * @param outputTargetDatasRows
	 * @param logger
	 */
	private async outputDatas(
		outputTargetDatasRows: OutputTargetDataRowType[],
		logger: (message: string) => Promise<void>,
	) {
		const outputMethod = await this.localStorage.getOutputTarget();
		const outputTargetOptions =
			await this.localStorage.getOutputTargetOptions();
		if (outputMethod === "download") {
			const outputTarget = this.outputTargetFactory.getDownloadOutputTarget();
			await outputTarget(outputTargetDatasRows, void 0, logger);
		} else if (outputMethod === "dropbox") {
			const outputTarget = this.outputTargetFactory.getDropboxOutputTarget();
			const newDropboxOption = await outputTarget(
				outputTargetDatasRows,
				outputTargetOptions.dropbox,
				logger,
			);
			await this.localStorage.setOutputTargetOptions({
				...outputTargetOptions,
				dropbox: newDropboxOption,
			});
		}
	}
}
