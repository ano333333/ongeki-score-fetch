import type { IRawLocalStorage } from "./rawLocalStorage/base";
import { defaultRawLocalStorageVer1 } from "./rawLocalStorageVerTypes/1";

const VALID_VERSIONS = [1];

export type LocalStorageType = {
	progresses: Array<{
		createdAt: number;
		message: string;
		type: "progress" | "error" | "finish";
	}>;
	outputTarget: "download" | "dropbox";
	outputTargetOptions: {
		dropbox: {
			outputPath: string;
			accessToken: string | undefined;
			expires: number | undefined;
		};
	};
};

export class LocalStorage {
	constructor(private readonly rawLocalStorage: IRawLocalStorage) {}
	public async validateRawLocalStorage() {
		const version = await this.rawLocalStorage.get<number>("version");
		if (!version || !VALID_VERSIONS.includes(version)) {
			const defaultRawLocalStorage = defaultRawLocalStorageVer1;
			for (const key in defaultRawLocalStorage) {
				await this.rawLocalStorage.set(
					key,
					defaultRawLocalStorage[key as keyof typeof defaultRawLocalStorage],
				);
			}
		}
	}
	public async getProgresses() {
		return (
			(await this.rawLocalStorage.get<LocalStorageType["progresses"]>(
				"progresses",
			)) ?? []
		);
	}
	public async appendProgresses(progress: LocalStorageType["progresses"][0]) {
		const progresses = (await this.getProgresses()) ?? [];
		return await this.rawLocalStorage.set("progresses", [
			...progresses,
			progress,
		]);
	}
	public addProgressesListener(
		listener: (progresses: LocalStorageType["progresses"]) => void,
	) {
		this.rawLocalStorage.addListener("progresses", listener);
	}
	public async clearProgresses() {
		return await this.rawLocalStorage.set("progresses", []);
	}
	public async getOutputTargetOptions() {
		return (
			(await this.rawLocalStorage.get<LocalStorageType["outputTargetOptions"]>(
				"outputTargetOptions",
			)) ?? {
				dropbox: {
					outputPath: "ongeki-score-fetch/data.csv",
					accessToken: undefined,
					expires: undefined,
				},
			}
		);
	}
	public async getOutputTarget() {
		return (
			(await this.rawLocalStorage.get<LocalStorageType["outputTarget"]>(
				"outputTarget",
			)) ?? "download"
		);
	}
	public async setOutputTarget(target: LocalStorageType["outputTarget"]) {
		return await this.rawLocalStorage.set("outputTarget", target);
	}
	public async setOutputTargetOptions(
		options: LocalStorageType["outputTargetOptions"],
	) {
		return await this.rawLocalStorage.set("outputTargetOptions", options);
	}
}
