export type BeatmapDataDifficultyType =
	| "BASIC"
	| "ADVANCED"
	| "EXPERT"
	| "MASTER"
	| "LUNATIC";

export type BeatmapDataType = {
	difficulty: BeatmapDataDifficultyType;
	name: string;
	const: number;
};

export interface IBeatmapDataSource {
	getBeatmapData(
		logger: (message: string) => Promise<void>,
	): Promise<BeatmapDataType[]>;
}
