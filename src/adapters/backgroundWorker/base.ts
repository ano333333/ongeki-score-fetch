export interface IBackgroundWorker {
	isDataFetching(): Promise<boolean>;
	fetchAndOutput(): Promise<void>;
}
