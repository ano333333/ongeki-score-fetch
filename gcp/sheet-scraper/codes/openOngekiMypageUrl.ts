import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { sleep } from "./utils/sleep";
import path from "node:path";

/**
 * オンゲキマイページのURLを開いてからコールバックを実行し、ブラウザを閉じる
 * @param url 開くURL
 * @param callback 開いたページを受け取るコールバック
 * @param authFilePath オンゲキマイページのcookieの保存先のパス
 * @returns
 */
export function openOngekiMypageUrl<T>(
	url: string,
	callback: (page: Page) => Promise<T>,
	authFilePath = "../auth.json",
) {
	const absAuthFilePath = path.resolve(__dirname, authFilePath);
	return (async () => {
		let browser: Browser | null = null;
		try {
			browser = await chromium.launch({
				headless: true,
			});
			const context = await browser.newContext({
				storageState: absAuthFilePath,
			});
			const page = await context.newPage();
			await page.goto(url);
			await page.waitForLoadState("load");
			await sleep(1000);

			return await callback(page);
		} finally {
			if (browser) {
				await browser.close();
			}
		}
	})();
}
