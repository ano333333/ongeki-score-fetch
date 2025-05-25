import { resolve } from "node:path";
import { Storage } from "@google-cloud/storage";

/**
 * sheet-storageからファイルをダウンロードする
 * @param key ファイルのキー
 * @param destination ダウンロード先のパス
 * @returns ダウンロードに成功したかどうか
 */
export async function downloadFromCloudStorage(
	key: string,
	destination: string,
) {
	const sheetStorageName = process.env.SHEET_STORAGE_NAME;
	if (!sheetStorageName) {
		throw new Error();
	}

	const storage = new Storage();
	const file = storage.bucket(sheetStorageName).file(key);
	const [exists] = await file.exists();
	if (!exists) {
		return false;
	}
	await file.download({
		destination: resolve(destination),
	});
	return true;
}
