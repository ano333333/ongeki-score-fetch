export type UserDataScoreDifficultyType =
	| "BASIC"
	| "ADVANCED"
	| "EXPERT"
	| "MASTER"
	| "LUNATIC";

export type UserDataScoreType = {
	difficulty: UserDataScoreDifficultyType;
	level: string;
	name: string;
	genre: string;
	technicalHighScore: number;
	overDamageHighScore: number;
	battleHighScore: number;
	fullBell: boolean;
	allBreak: boolean;
	platinumHighScore: number;
	platinumStar: number; // 0(none),1~5,6(rainbow)
	platinumMaxScore: number; // NOTE: ongeki-score.netのデータにないためマイページから取得
};

export interface IUserDataSource {
	getUserData(
		logger: (message: string) => Promise<void>,
	): Promise<UserDataScoreType[]>;
}
