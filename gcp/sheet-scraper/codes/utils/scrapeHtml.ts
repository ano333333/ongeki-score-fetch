import type { Page, Browser } from "playwright";
import { chromium } from "playwright";
import { sleep } from "./sleep";
import path from "node:path";

const SCRAPE_INTERVAL = 3000;

/**
 * ページのHTMLを取得する。
 * またページアクセスからこのPromise終了までがSCRAPE_INTERVALミリ秒になるようにsleepを挟む
 * @param url
 * @param authFilePath
 * @returns 曲タイトルをkey、セクション名をvalueとするMap
 */
export async function scrapeHtml(url: string, authFilePath: string) {
	const callback = async (page: Page) => {
		console.log(`executeLogicWithHtml start: ${url}`);
		const html = await page.content();
		console.log(`executeLogicWithHtml end: ${url}`);
		return html;
	};
	const promises = [
		openOngekiMypageUrl(url, callback, authFilePath),
		sleep(SCRAPE_INTERVAL),
	];
	const [html, _] = await Promise.all(promises);
	return html as string;
}

/**
 * オンゲキマイページのURLを開いてからコールバックを実行し、ブラウザを閉じる
 * @param url 開くURL
 * @param callback 開いたページを受け取るコールバック
 * @param authFilePath オンゲキマイページのcookieの保存先のパス
 * @returns
 */
function openOngekiMypageUrl<T>(
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
