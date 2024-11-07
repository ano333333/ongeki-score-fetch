import { chromium } from "playwright";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function test() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto("https://ongeki-net.com/ongeki-mobile/");

	// screen shot
	await page.screenshot({ path: "screenshot.png" });

	// 最初のinput要素を取得し、「test」と入力
	const inputElement = await page.$("input");
	if (inputElement) {
		await inputElement.fill("test");
	} else {
		console.log("Input element not found");
	}

	await page.screenshot({ path: "screenshot2.png" });

	await sleep(5000);

	// ブラウザを閉じる
	await browser.close();
}
