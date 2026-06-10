import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import type { Page } from "@playwright/test";
import { test, expect, e2eDownloadDir } from "./fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const session_file = ".auth/user.json";
const downloadedCsvFixturePath = path.resolve(
	__dirname,
	"fixtures/downloaded_csv.json",
);

test.describe("Popup", () => {
	const tokyoHour = Number(
		new Intl.DateTimeFormat("ja-JP", {
			timeZone: "Asia/Tokyo",
			hour: "2-digit",
			hour12: false,
		}).format(new Date()),
	);
	test.beforeAll(() => {
		if (4 <= tokyoHour && tokyoHour < 7) {
			throw new Error(
				"popupのE2Eテストは午前4時から午前7時（JST）以外の時間に行ってください。",
			);
		}
	});

	test("popupが正しく開ける", async ({ page, extensionUrl }) => {
		// popup.htmlを新しいページとして開く
		await page.goto(extensionUrl("popup.html"));

		// popupのコンテンツが表示されることを確認
		await expect(page.locator("#app")).toBeVisible();
	});

	test("ログイン情報が無い時「スコア情報取得」ボタンを押すとエラー表示が出る", async ({
		page,
		extensionUrl,
	}) => {
		await page.goto(extensionUrl("popup.html"));

		const fetchScoreButton = page.getByRole("button", {
			name: "スコア情報取得",
		});
		await fetchScoreButton.click();

		await expect(
			page.getByText("ユーザーデータ取得中にエラーが発生しました。"),
		).toBeVisible({ timeout: 3000 });
	});

	test("ログイン情報がある時「スコア情報取得」ボタンを押すとリザルトCSVがダウンロードされる", async ({
		page,
		extensionUrl,
	}) => {
		test.setTimeout(10 * 60 * 1000);
		await login(page);
		await resetDownloadedCsvArtifacts();

		await page.goto(extensionUrl("popup.html"));
		const fetchScoreButton = page.getByRole("button", {
			name: "スコア情報取得",
		});

		const downloadPathPromise = waitForDownloadedCsvPath(4 * 60 * 1000);
		await fetchScoreButton.click();

		await expect(fetchScoreButton).toBeDisabled();

		await expect(page.getByText("全ユーザースコアデータ取得完了")).toBeVisible({
			timeout: 2 * 60 * 1000,
		});
		await expect(
			page.getByText("クラウドから譜面の属性情報を取得完了"),
		).toBeVisible({ timeout: 1 * 60 * 1000 });
		await expect(page.getByText("完了しました")).toBeVisible({
			timeout: 1 * 60 * 1000,
		});
		for (const difficulty of ["BASIC", "ADVANCED", "EXPERT", "MASTER"]) {
			await expect(
				page.getByText(`${difficulty}のユーザースコアデータ取得完了`),
			).toBeVisible();
		}
		await expect(
			page.getByText("クラウドから譜面の属性情報を取得完了"),
		).toBeVisible();
		await expect(page.getByText("情報取得可能です")).toBeVisible();
		await expect(fetchScoreButton).not.toBeDisabled();

		const downloadPath = await downloadPathPromise;
		const csvContent = await fs.readFile(downloadPath, "utf-8");
		await expectDownloadedCsvToContainFixtureRows(csvContent);
	});
});

async function login(page: Page): Promise<void> {
	const user_name = process.env.VITE_USER_NAME;
	const user_password = process.env.VITE_USER_PASSWORD;
	if (!user_name || !user_password) {
		throw new Error("E2Eテスト用のユーザーアカウント情報が不足しています。");
	}
	await page.goto("https://ongeki-net.com/ongeki-mobile/");
	await page.getByPlaceholder("SEGA ID").fill(user_name);
	await page.getByPlaceholder("パスワード").fill(user_password);
	const submit = await page.$("button[type='submit']");
	if (!submit) {
		throw new Error("could not find submit button");
	}
	await submit.click();
	await page.waitForURL("https://ongeki-net.com/ongeki-mobile/aimeList/");

	const aime_login = await page.$("button[type='submit']");
	if (!aime_login) {
		throw new Error("could not find aime login button");
	}
	await aime_login.click();
	await page.waitForURL("https://ongeki-net.com/ongeki-mobile/home/");
	await page.context().storageState({ path: session_file });
}

async function resetDownloadedCsvArtifacts(): Promise<void> {
	await fs.rm(e2eDownloadDir, { recursive: true, force: true });
	await fs.mkdir(e2eDownloadDir, { recursive: true });
}

async function findDownloadedCsvPath(): Promise<string | null> {
	try {
		const entries = await fs.readdir(e2eDownloadDir);
		const fileName = entries.find(
			(entry) =>
				!entry.startsWith(".") &&
				entry.toLowerCase().endsWith(".csv") &&
				!entry.toLowerCase().endsWith(".crdownload"),
		);
		if (!fileName) {
			return null;
		}
		return path.join(e2eDownloadDir, fileName);
	} catch {
		return null;
	}
}

async function waitForDownloadedCsvPath(timeoutMs: number): Promise<string> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const downloadedPath = await findDownloadedCsvPath();
		if (downloadedPath) {
			try {
				const first = await fs.stat(downloadedPath);
				await new Promise((resolve) => setTimeout(resolve, 500));
				const second = await fs.stat(downloadedPath);
				if (first.size > 0 && first.size === second.size) {
					return downloadedPath;
				}
			} catch {
				// ファイルが更新中または移動中なら次のループで再試行する
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw new Error("拡張機能が出力したCSVの保存を待機中にタイムアウトしました");
}

async function expectDownloadedCsvToContainFixtureRows(
	csvContent: string,
): Promise<void> {
	const expectedRows = await loadExpectedDownloadedCsvRows();
	const actualRows = parseCsvRows(csvContent).map(normalizeCsvRow);

	for (const expectedRow of expectedRows.map(normalizeCsvRow)) {
		expect(actualRows).toContainEqual(expectedRow);
	}
}

async function loadExpectedDownloadedCsvRows(): Promise<string[][]> {
	const fixtureText = await fs.readFile(downloadedCsvFixturePath, "utf-8");
	return JSON.parse(fixtureText) as string[][];
}

function parseCsvRows(csvContent: string): string[][] {
	const parsed = Papa.parse<string[]>(csvContent, {
		skipEmptyLines: true,
	});
	if (parsed.errors.length > 0) {
		throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
	}
	return parsed.data.slice(1);
}

function normalizeCsvRow(row: string[]): string[] {
	return row.map((value) => value.trim().toLowerCase());
}
