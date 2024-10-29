import type { BeatmapDataType, IBeatmapDataSource } from "./base";

const mockDatas: BeatmapDataType[] = [
	{
		difficulty: "BASIC",
		name: "test1",
		const: 1.0,
	},
	{
		difficulty: "ADVANCED",
		name: "test1",
		const: 2.0,
	},
	{
		difficulty: "EXPERT",
		name: "test1",
		const: 3.0,
	},
	{
		difficulty: "MASTER",
		name: "test1",
		const: 4.0,
	},
	{
		difficulty: "BASIC",
		name: "test2",
		const: 1.3,
	},
	{
		difficulty: "ADVANCED",
		name: "test2",
		const: 2.3,
	},
	{
		difficulty: "EXPERT",
		name: "test2",
		const: 3.3,
	},
	{
		difficulty: "MASTER",
		name: "test2",
		const: 4.3,
	},
	{
		difficulty: "LUNATIC",
		name: "test2",
		const: 5.3,
	},
	{
		difficulty: "BASIC",
		name: "test3",
		const: 1.5,
	},
	{
		difficulty: "ADVANCED",
		name: "test3",
		const: 2.5,
	},
	{
		difficulty: "EXPERT",
		name: "test3",
		const: 3.5,
	},
	{
		difficulty: "MASTER",
		name: "test3",
		const: 4.5,
	},
];

export class MockBeatmapDataSource implements IBeatmapDataSource {
	async getBeatmapData(
		logger: (message: string) => Promise<void>,
	): Promise<BeatmapDataType[]> {
		await logger("MockBeatmapDataSource.getBeatmapData start");
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await logger("MockBeatmapDataSource.getBeatmapData end");
		return mockDatas;
	}
}
