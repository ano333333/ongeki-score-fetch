import type { LocalStorage, LocalStorageType } from "../adapters/localStorage";

export class OptionsController {
	constructor(
		private readonly localStorage: LocalStorage,
		progressesListener: (progresses: LocalStorageType["progresses"]) => void,
	) {
		this.localStorage.addProgressesListener(progressesListener);
	}

	async getOutputTarget(): Promise<LocalStorageType["outputTarget"]> {
		return await this.localStorage.getOutputTarget();
	}

	async getOutputTargetOptions(): Promise<
		LocalStorageType["outputTargetOptions"]
	> {
		return await this.localStorage.getOutputTargetOptions();
	}

	async getProgresses(): Promise<LocalStorageType["progresses"]> {
		return await this.localStorage.getProgresses();
	}

	async setOutputTargetAndOptions(
		target: LocalStorageType["outputTarget"],
		options: LocalStorageType["outputTargetOptions"],
	) {
		await this.localStorage.setOutputTarget(target);
		await this.localStorage.setOutputTargetOptions(options);
	}

	/**
	 * 与えられたパスが、Dropboxの出力先として用いることができる正しいパス形式か否か
	 * @param path
	 * @returns
	 */
	isOutputPathValid(path: string) {
		// パスに使用できない文字が含まれていればfalse
		const unusable = /[\\:\*\?\"<>\|]/;
		if (path.search(unusable) !== -1) {
			return false;
		}
		// \/ で始まっていればfalse
		if (path.startsWith("/")) {
			return false;
		}
		// outputPathの拡張子が.csvまたは.txtでなければfalse
		const ext = path.split(".").pop();
		if (ext !== "csv" && ext !== "txt") {
			return false;
		}
		return true;
	}
}
