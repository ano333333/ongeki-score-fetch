import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, chromium, type BrowserContext } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// `chrome.downloads.download`によるダウンロードのため、CSVダウンロードの内容確認のために一時ファイル書き出しが必要
export const e2eDownloadDir = path.join(
	os.tmpdir(),
	"ongeki-score-fetch-e2e-browser-downloads",
);

const executablePath = process.env.PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH;

export const test = base.extend<{
	context: BrowserContext;
	extensionId: string;
	extensionUrl: (
		pathname: string,
		searchParams?: { [key: string]: string },
	) => string;
}>({
	// biome-ignore lint/correctness/noEmptyPattern: playwrightのcontextを使うためには空のオブジェクトを渡す必要がある
	context: async ({}, use) => {
		// ビルド済みのChrome拡張機能のパスを指定
		const pathToExtension = path.join(__dirname, "../../dist");
		const context = await chromium.launchPersistentContext("", {
			acceptDownloads: true,
			downloadsPath: e2eDownloadDir,
			...(executablePath ? { executablePath } : {}),
			args: [
				`--disable-extensions-except=${pathToExtension}`,
				`--load-extension=${pathToExtension}`,
			],
		});
		await use(context);
		await context.close();
	},
	extensionId: async ({ context }, use) => {
		// Manifest v3のservice workerからextensionIdを取得
		let [background] = context.serviceWorkers();
		if (!background) {
			background = await context.waitForEvent("serviceworker");
		}

		const extensionId = new URL(background.url()).hostname;
		await use(extensionId);
	},
	extensionUrl: async ({ extensionId }, use) => {
		await use((pathname, searchParams) => {
			const url = new URL(pathname, `chrome-extension://${extensionId}`);
			if (searchParams) {
				url.search = new URLSearchParams(searchParams).toString();
			}
			return url.toString();
		});
	},
});

export const expect = test.expect;
