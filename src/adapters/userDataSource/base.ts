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
};

export interface IUserDataSource {
	getUserData(
		logger: (message: string) => Promise<void>,
	): Promise<UserDataScoreType[]>;
	isUserDataFetchable(): Promise<true | string>;
}
