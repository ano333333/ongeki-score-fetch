export interface IRawLocalStorage {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, value: T): Promise<void>;
	addListener<T>(
		key: string,
		callback: (newValue: T, oldValue: T) => void,
	): void;
}
