import type { LocalStorage, LocalStorageType } from "../adapters/localStorage";
import type { IBackgroundWorker } from "../adapters/backgroundWorker/base";

export class PopupController {
	constructor(
		private readonly localStorage: LocalStorage,
		private readonly backgroundWorker: IBackgroundWorker,
		progressesListener: (progress: LocalStorageType["progresses"]) => void,
	) {
		this.localStorage.addProgressesListener(progressesListener);
		this.localStorage
			.validateRawLocalStorage()
			.then(() => this.checkProgressesAndBackgroundWorkerConsistency())
			.catch((e) => console.error(e));
	}

	async getLocalStorageProgresses() {
		return await this.localStorage.getProgresses();
	}

	async fetchAndOutputData() {
		await this.backgroundWorker.fetchAndOutput();
	}
	/**
	 * ローカルストレージのprogressesとbackgroundWorkerの稼働状況の一貫性を確認し、矛盾する場合エラーメッセージを最後に追加する
	 */
	private async checkProgressesAndBackgroundWorkerConsistency() {
		const progress = (await this.localStorage.getProgresses()).at(-1);
		const isBackgroundWorkerFetching =
			await this.backgroundWorker.isDataFetching();
		if (progress?.type === "progress" && !isBackgroundWorkerFetching) {
			await this.localStorage.appendProgresses({
				createdAt: Date.now(),
				type: "error",
				message: "データフェッチ・出力が中断されました",
			});
		}
	}
}
