export type OutputTargetDataRowDifficultyType =
	| "BASIC"
	| "ADVANCED"
	| "EXPERT"
	| "MASTER"
	| "LUNATIC";

export type OutputTargetDataRowType = {
	difficulty: OutputTargetDataRowDifficultyType;
	level: string;
	name: string;
	genre: string;
	technicalHighScore: number;
	overDamageHighScore: number;
	battleHighScore: number;
	fullBell: boolean;
	allBreak: boolean;
	const: number | undefined;
	platinumHighScore: number;
	platinumStar: number;
	platinumMaxScore: number;
	character: string | undefined;
	version: string | undefined;
};

export type OutputTargetType<T> = (
	datas: OutputTargetDataRowType[],
	option: T,
	logger: (message: string) => Promise<void>,
) => Promise<T>;
