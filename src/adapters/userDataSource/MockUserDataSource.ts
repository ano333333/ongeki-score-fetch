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
	},
];

export class MockUserDataSource implements IUserDataSource {
	async getUserData(): Promise<UserDataScoreType[]> {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return mockDatas;
	}
}
