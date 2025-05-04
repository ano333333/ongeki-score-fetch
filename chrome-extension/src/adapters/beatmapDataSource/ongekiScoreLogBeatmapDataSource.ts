import type {
	BeatmapDataDifficultyType,
	BeatmapDataType,
	IBeatmapDataSource,
} from "./base";
import Papa from "papaparse";

export class OngekiScoreLogBeatmapDataSource implements IBeatmapDataSource {
	async getBeatmapData(
		logger: (message: string) => Promise<void>,
	): Promise<BeatmapDataType[]> {
		await logger("譜面の属性情報を取得開始");
		// NOTE: キャッシュ戦略を考える
		const response = await fetch(import.meta.env.VITE_BEATMAP_DATA_SOURCE_URL);
		const rawDatas = await response.text();
		const csv = await this.parse(rawDatas);
		const beatmapDatas = new Array<BeatmapDataType>();
		for (const row of csv) {
			const createRow = (
				row: string[],
				difficulty: BeatmapDataDifficultyType,
				versionIndex: number,
				constIndex: number,
			) => {
				beatmapDatas.push({
					name: row[0],
					genre: row[1],
					character: row[2],
					version: row[versionIndex],
					difficulty,
					const: row[constIndex] ? Number(row[constIndex]) : undefined,
				});
			};
			createRow(row, "BASIC", 3, 5);
			createRow(row, "ADVANCED", 3, 6);
			createRow(row, "EXPERT", 3, 7);
			createRow(row, "MASTER", 3, 8);
			createRow(row, "LUNATIC", 4, 9);
		}
		await logger("譜面の属性情報を取得完了");
		return beatmapDatas;
	}

	parse(csvText: string): Promise<string[][]> {
		return new Promise((resolve, reject) => {
			Papa.parse(csvText, {
				header: false,
				complete: (results) => {
					if (results.errors.length > 0) {
						reject(results.errors);
					} else {
						resolve(results.data as string[][]);
					}
				},
			});
		});
	}
}
