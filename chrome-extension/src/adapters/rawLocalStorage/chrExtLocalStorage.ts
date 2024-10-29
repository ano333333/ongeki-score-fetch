import type { IRawLocalStorage } from "./base";

export class ChrExtLocalStorage implements IRawLocalStorage {
	private readonly storage = chrome.storage.local;

	async get<T>(key: string): Promise<T | undefined> {
		const res = await this.storage.get(key);
		return res[key] as T | undefined;
	}

	async set<T>(key: string, value: T): Promise<void> {
		console.log(this);
		console.log(this.storage);
		return await this.storage.set({ [key]: value });
	}

	addListener<T>(
		key: string,
		callback: (newValue: T, oldValue: T) => void,
	): void {
		chrome.storage.onChanged.addListener((changes, areaName) => {
			if (areaName === "local" && changes[key]) {
				callback(changes[key].newValue as T, changes[key].oldValue as T);
			}
		});
	}
}
