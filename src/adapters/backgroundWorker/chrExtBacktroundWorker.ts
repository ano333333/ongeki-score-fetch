import type { ChrExtRuntimeMessageType } from "../../messages";
import type { IBackgroundWorker } from "./base";

export class ChrExtBacktroundWorker implements IBackgroundWorker {
	async isDataFetching(): Promise<boolean> {
		return await chrome.runtime.sendMessage({
			type: "is-fetch-processing",
			from: "popup",
			to: "backgroundWorker",
		} as ChrExtRuntimeMessageType);
	}
	async fetchAndOutput(): Promise<void> {
		await chrome.runtime.sendMessage({
			type: "start-fetch",
			from: "popup",
			to: "backgroundWorker",
		} as ChrExtRuntimeMessageType);
	}
}
