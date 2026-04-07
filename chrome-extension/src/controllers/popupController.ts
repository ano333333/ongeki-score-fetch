import type { IBackgroundWorker } from "../adapters/backgroundWorker/base";
import type { LocalStorage, LocalStorageType } from "../adapters/localStorage";

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
}
