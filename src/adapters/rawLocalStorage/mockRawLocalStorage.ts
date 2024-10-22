import type { IRawLocalStorage } from "./base";

type StorageValueType =
	| string
	| number
	| boolean
	| StorageValueObjectType
	| StorageValueArrayType
	| null;
interface StorageValueObjectType {
	[key: string]: StorageValueType;
}
interface StorageValueArrayType extends Array<StorageValueType> {}

export class MockRawLocalStorage implements IRawLocalStorage {
	private storage: StorageValueObjectType = {};
	private listeners: {
		[key: string]: ((
			newValue: StorageValueType,
			oldValue: StorageValueType,
		) => void)[];
	} = {};

	async get<T>(key: string): Promise<T | undefined> {
		return this.storage[key] as T | undefined;
	}

	async set<T>(key: string, value: T): Promise<void> {
		const oldValue = this.storage[key];
		this.storage[key] = value as StorageValueType;
		for (const listener of this.listeners[key] ?? []) {
			listener(value as StorageValueType, oldValue as StorageValueType);
		}
	}

	addListener<T>(
		key: string,
		callback: (newValue: T, oldValue: T) => void,
	): void {
		if (!this.listeners[key]) {
			this.listeners[key] = [];
		}
		this.listeners[key].push(
			callback as (
				newValue: StorageValueType,
				oldValue: StorageValueType,
			) => void,
		);
	}
}
