export type BeatmapDataDifficultyType =
	| "BASIC"
	| "ADVANCED"
	| "EXPERT"
	| "MASTER"
	| "LUNATIC";

export type BeatmapDataType = {
	name: string;
	genre: string | undefined;
	character: string | undefined;
	version: string | undefined;
	difficulty: BeatmapDataDifficultyType;
	const: number | undefined;
};

export interface IBeatmapDataSource {
	getBeatmapData(
		logger: (message: string) => Promise<void>,
	): Promise<BeatmapDataType[]>;
}
