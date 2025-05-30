import { google, type sheets_v4 } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import type { JWT } from "google-auth-library";
import type { RecordConstsType } from "./logics/recordConstsType";
import type { DifficultyType } from "./logics/difficultyType";

export type SpreadsheetRowType = {
	title: string;
	difficulty: DifficultyType;
	constant: number;
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

export async function getSpreadsheetBeatmapInfos() {
	const sheetsapi = await getSheetsApi();
	const sheetId = process.env.SPREAD_SHEET_ID;
	if (!sheetId) {
		throw new Error();
	}

	const sheetNames = ["15+〜14+", "14", "13+", "13", "12+", "12", "11+", "11"];
	const infos: SpreadsheetRowType[] = [];
	for (const sheetName of sheetNames) {
		infos.push(
			...(await getBeatmapInfosFromSheet(sheetsapi, sheetId, sheetName)),
		);
	}
	const merged = mergeSpreadsheetRows(infos);
	return merged;
}

async function getSheetsApi() {
	// credentials.jsonが存在するときはoauth2認証を使用する
	// (主にローカルでの開発時に使用)
	let auth: JWT;
	if (fs.existsSync(CREDENTIALS_PATH)) {
		auth = (await google.auth.getClient({
			keyFile: CREDENTIALS_PATH,
			scopes: SCOPES,
		})) as JWT;
	} else {
		auth = (await google.auth.getClient({
			scopes: SCOPES,
		})) as JWT;
	}
	return google.sheets({
		version: "v4",
		auth,
	});
}

/**
 * 指定範囲(シート名:A~Fなど)を受け取り、そのシートに含まれるBeatmapInfoを取得する
 * @param sheetsapi
 * @param sheetId
 * @param range
 * @returns Promise<SpreadsheetBeatmapInfo[]>
 */
async function getBeatmapInfosFromSheet(
	sheetsapi: sheets_v4.Sheets,
	sheetId: string,
	range: string,
) {
	const sheetValues = (
		await sheetsapi.spreadsheets.values.get({
			spreadsheetId: sheetId,
			range,
		})
	).data.values;
	if (!sheetValues) {
		throw new Error();
	}

	// 各行について、6列ごと(A~F,G~L,...)に分割する。
	// 空白行や「曲名,難易度,...」の行はスキップする
	const musicRows: (string | number)[][][] = [];
	for (const row of sheetValues) {
		const musicColumnNum = Math.ceil(row.length / 6);
		for (
			let musicColumnIndex = 0;
			musicColumnIndex < musicColumnNum;
			musicColumnIndex++
		) {
			const musicColumn = row.slice(
				musicColumnIndex * 6,
				(musicColumnIndex + 1) * 6,
			);
			if (musicColumn[0] === "" || musicColumn[1] === "") {
				continue;
			}
			if (musicColumn[0] === "曲名") {
				continue;
			}
			if (musicRows.length < musicColumnIndex + 1) {
				musicRows.push([]);
			}
			musicRows[musicColumnIndex].push(musicColumn as (string | number)[]);
		}
	}

	const consts: SpreadsheetRowType[] = [];
	/**
	 * 各行は
	 * - 曲名
	 * - 難易度(BASIC, ADVANCED, EXPERT, MASTER, LUNATIC)
	 * - ジャンル
	 * - 旧定数
	 * - 新定数
	 * - (空白)
	 */
	for (const musicRow of musicRows) {
		for (const column of musicRow) {
			const title = column[0] as string;
			const difficulty = column[1] as DifficultyType;
			const constant = Number(column[4]);
			consts.push({ title, difficulty, constant });
		}
	}
	return consts;
}

function mergeSpreadsheetRows(rows: SpreadsheetRowType[]) {
	const result = new Map<string, RecordConstsType>();
	for (const row of rows) {
		let map = result.get(row.title);
		if (!map) {
			map = {
				title: row.title,
				consts: {
					BASIC: undefined,
					ADVANCED: undefined,
					EXPERT: undefined,
					MASTER: undefined,
					LUNATIC: undefined,
				},
			};
		}
		map.consts[row.difficulty] = row.constant;
		result.set(row.title, map);
	}
	return result;
}
