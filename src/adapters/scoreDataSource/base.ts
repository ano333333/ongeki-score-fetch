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

export interface IScoreDataSource {
	getScoreData(): Promise<BeatmapDataType[]>;
}
