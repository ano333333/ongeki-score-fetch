import type { IUserDataSource, UserDataScoreType } from "./base";

const mockDatas: UserDataScoreType[] = [
	{
		difficulty: "BASIC",
		level: "1",
		name: "test1",
		genre: "genre1",
		technicalHighScore: 100_0000,
		overDamageHighScore: 100_0000,
		battleHighScore: 100_0000,
		fullBell: true,
		allBreak: true,
		platinumHighScore: 450,
		platinumStar: 0,
		platinumMaxScore: 500,
	},
	{
		difficulty: "ADVANCED",
		level: "2",
		name: "test2",
		genre: "genre2",
		technicalHighScore: 100_0000,
		overDamageHighScore: 100_0000,
		battleHighScore: 100_0000,
		fullBell: false,
		allBreak: false,
		platinumHighScore: 600 * 0.94,
		platinumStar: 1,
		platinumMaxScore: 600,
	},
	{
		difficulty: "EXPERT",
		level: "3",
		name: "test3",
		genre: "genre3",
		technicalHighScore: 100_0000,
		overDamageHighScore: 100_0000,
		battleHighScore: 100_0000,
		fullBell: true,
		allBreak: true,
		platinumHighScore: 700 * 0.96,
		platinumStar: 3,
		platinumMaxScore: 700,
	},
	{
		difficulty: "MASTER",
		level: "4",
		name: "test3",
		genre: "genre3",
		technicalHighScore: 100_0000,
		overDamageHighScore: 100_0000,
		battleHighScore: 100_0000,
		fullBell: true,
		allBreak: true,
		platinumHighScore: 800 * 0.98,
		platinumStar: 5,
		platinumMaxScore: 800,
	},
];

export class MockUserDataSource implements IUserDataSource {
	async getUserData(
		logger: (message: string) => Promise<void>,
	): Promise<UserDataScoreType[]> {
		await logger("MockUserDataSource.getUserData start");
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await logger("MockUserDataSource.getUserData end");
		return mockDatas;
	}
}
