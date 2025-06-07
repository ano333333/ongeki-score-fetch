import { Storage } from "@google-cloud/storage";

/**
 * バケットから最新のCSVファイルをダウンロードする
 * 1. result.csvが存在すればそれをダウンロード
 * 2. 存在しなければメタデータJSONから最新ファイル名を取得してダウンロード
 * @param bucketName バケット名
 * @param localCsvPath ローカル保存先パス
 * @returns CSVファイルが存在したかどうか
 */
export async function downloadLatestCsv(
	bucketName: string,
	localCsvPath: string,
): Promise<boolean> {
	const storage = new Storage();
	const bucket = storage.bucket(bucketName);

	try {
		// まずresult.csvが存在するかチェック
		const resultCsvFile = bucket.file("result.csv");
		const [exists] = await resultCsvFile.exists();

		if (exists) {
			console.log("result.csv found, downloading...");
			await resultCsvFile.download({ destination: localCsvPath });
			return true;
		}

		// result.csvが存在しない場合、メタデータJSONから最新ファイル名を取得
		console.log("result.csv not found, checking for metadata...");
		const metadataFile = bucket.file("result-latest.json");
		const [metadataExists] = await metadataFile.exists();

		if (!metadataExists) {
			console.log("No CSV files found in bucket");
			return false;
		}

		// メタデータを読み込み
		const [metadataContent] = await metadataFile.download();
		const metadata = JSON.parse(metadataContent.toString());
		const latestFileName = metadata.latestFileName;

		if (!latestFileName) {
			console.log("No latest file name found in metadata");
			return false;
		}

		// 最新ファイルをダウンロード
		console.log(`Downloading latest file: ${latestFileName}`);
		const latestFile = bucket.file(latestFileName);
		const [latestExists] = await latestFile.exists();

		if (!latestExists) {
			console.log(`Latest file ${latestFileName} not found`);
			return false;
		}

		await latestFile.download({ destination: localCsvPath });
		return true;
	} catch (error) {
		console.error("Error downloading CSV:", error);
		return false;
	}
} 