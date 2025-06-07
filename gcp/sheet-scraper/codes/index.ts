import http from "node:http";
import { getSpreadsheetBeatmapInfos } from "./getSpreadsheetBeatmapInfos";
import { dumpReturnResultCsv } from "./dumpReturnResultCsv";
import fs from "node:fs";
import { getStdRecordPageMusicDatas } from "./logics/getStdRecordPageMusicDatas";
import { saveOngekiMypageAuth } from "./utils/saveOngekiMypageAuth";
import { scrapeHtml } from "./utils/scrapeHtml";
import { downloadLatestCsv } from "./utils/downloadLatestCsv";
import { loadResultCsv } from "./logics/loadResultCsv";
import { overwriteResultCsvRowsMap } from "./logics/overwriteResultCsvRowsMap";
import { getPrmRecordPageMusicDatas } from "./logics/getPrmRecordPageMusicDatas";
import { createResultCsvRowsMap } from "./logics/createResultCsvRowsMap";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
import { updateFileWithCleanup } from "./utils/fileManager";

const authFilePath = path.resolve(__dirname, "../auth.json");
const localCsvPath = path.resolve(__dirname, "./result.csv");

// Cloud Storage初期化
const storage = new Storage();
const bucketName = process.env.SHEET_STORAGE_NAME || "sheet-storage-stg";

const server = http.createServer(async (req, res) => {
	try {
		console.log(`${req.method} ${req.url}`);

		const userName = process.env.SEGA_USER_NAME;
		const password = process.env.SEGA_PASSWORD;
		if (!userName || !password) {
			throw new Error();
		}
		await saveOngekiMypageAuth(userName, password, authFilePath);

		// 1. スタンダードページの情報取得
		const stdDatas = await getStdRecordPageMusicDatas((url) =>
			scrapeHtml(url, authFilePath),
		);

		// 2. スプレッドシートの情報取得
		const spreadsheetDatas = await getSpreadsheetBeatmapInfos();

		// 3. クラウドストレージから最新のCSVファイルをダウンロード
		const doesCsvExists = await downloadLatestCsv(bucketName, localCsvPath);

		// 4. 古いデータが存在すればマージし、更新が必要ならば上書き
		if (doesCsvExists) {
			console.log("old csv exists");
			const curVersionName = process.env.CURRENT_ONGEKI_VERSION_NAME;
			if (!curVersionName) {
				throw new Error();
			}
			const csvDatas = await loadResultCsv(localCsvPath);
			const needsUpdate = overwriteResultCsvRowsMap(
				csvDatas,
				stdDatas.master,
				stdDatas.lunatic,
				curVersionName,
				spreadsheetDatas,
			);
			if (needsUpdate) {
				console.log("needs update");
				const csvDump = dumpReturnResultCsv(csvDatas);

				// ランダムID付きファイル名でGCSにアップロード
				const newFileName = await updateFileWithCleanup(
					storage,
					bucketName,
					"result",
					"csv",
					csvDump,
				);
				console.log(`Uploaded to GCS: ${newFileName}`);
			} else {
				console.log("no update");
			}
		}
		// 5. 古いデータが存在しなければ、プレミアムのページにもアクセスし新しいデータを生成
		else {
			console.log("old csv not exists");
			const prmDatas = await getPrmRecordPageMusicDatas((url) =>
				scrapeHtml(url, authFilePath),
			);
			const csvDatas = await createResultCsvRowsMap(
				stdDatas.master,
				stdDatas.lunatic,
				prmDatas.master,
				prmDatas.lunatic,
				spreadsheetDatas,
			);
			const csvDump = dumpReturnResultCsv(csvDatas);

			// ランダムID付きファイル名でGCSにアップロード
			const newFileName = await updateFileWithCleanup(
				storage,
				bucketName,
				"result",
				"csv",
				csvDump,
			);
			console.log(`Uploaded to GCS: ${newFileName}`);
		}
	} catch (e) {
		console.error(e);
	} finally {
		if (fs.existsSync(localCsvPath)) {
			fs.rmSync(localCsvPath);
		}
		if (fs.existsSync(authFilePath)) {
			fs.rmSync(authFilePath);
		}
		res.statusCode = 200;
		res.end();
		console.log("end");
	}
});

server.listen(8080, () => {
	console.log("Server running at http://localhost:8080/");
});
