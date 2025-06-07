import type {
	BeatmapDataDifficultyType,
	BeatmapDataType,
	IBeatmapDataSource,
} from "./base";
import Papa from "papaparse";

export class GcsBeatmapDataSource implements IBeatmapDataSource {
	constructor(private readonly bucketUrl: string) {}

	async getBeatmapData(
		logger: (message: string) => Promise<void>,
	): Promise<BeatmapDataType[]> {
		await logger("クラウドから譜面の属性情報を取得開始");

		let dataUrl: string;
		
		try {
			// まずメタデータを取得して最新ファイル名を取得
			await logger("メタデータファイルを確認中...");
			const metadataUrl = `${this.bucketUrl}/result-latest.json`;
			const metadataResponse = await fetch(metadataUrl, {
				cache: 'no-cache' // 常にサーバーから最新のメタデータを取得
			});
			
			if (!metadataResponse.ok) {
				throw new Error(`メタデータ取得に失敗: ${metadataResponse.status}`);
			}
			
			const metadata = await metadataResponse.json();
			const latestFileName = metadata.latestFileName;
			
			if (!latestFileName) {
				throw new Error("メタデータに最新ファイル名が存在しません");
			}
			
			dataUrl = `${this.bucketUrl}/${latestFileName}`;
			await logger(`最新ファイルを使用: ${latestFileName}`);
			
		} catch (error) {
			// メタデータ取得に失敗した場合、result.csvをフォールバックとして使用
			await logger("メタデータ取得に失敗、result.csvをフォールバックとして使用");
			console.warn("メタデータ取得に失敗、result.csvを使用:", error);
			dataUrl = `${this.bucketUrl}/result.csv`;
		}

		// 実際のCSVデータを取得
		const response = await fetch(dataUrl, {
			cache: 'default' // ブラウザのデフォルトキャッシュ戦略を使用
		});
		if (!response.ok) {
			throw new Error(`CSVデータ取得に失敗: ${response.status}`);
		}
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
		await logger("クラウドから譜面の属性情報を取得完了");
		return beatmapDatas;
	}

	parse(csvText: string): Promise<string[][]> {
		return new Promise((resolve, reject) => {
			Papa.parse(csvText, {
				header: false,
				complete: (results: Papa.ParseResult<string[]>) => {
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