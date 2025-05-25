import { Storage } from "@google-cloud/storage";

export async function uploadToSheetStorage(filePath: string, key: string) {
	const sheetStorageName = process.env.SHEET_STORAGE_NAME;
	if (!sheetStorageName) {
		throw new Error("SHEET_STORAGE_NAME is not set");
	}

	const storage = new Storage();
	const options = {
		destination: key,
	};
	console.log(`Uploading ${filePath} to ${sheetStorageName}/${key}`);
	await storage.bucket(sheetStorageName).upload(filePath, options);
	console.log(`Uploaded ${filePath} to ${sheetStorageName}/${key}`);
}
