import path from "node:path";
import { chromium } from "playwright";

const authFile = path.resolve(__dirname, "../auth.json");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function test() {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto("https://ongeki-net.com/ongeki-mobile/");

	// ユーザ・パスワードを入力しログインボタンをクリック
	const userInputSelector =
		"body > div.wrapper.main_wrapper.t_c > div.login_container.p_10.t_c > form > div > input[type=text]:nth-child(1)";
	const passwordInputSelector =
		"body > div.wrapper.main_wrapper.t_c > div.login_container.p_10.t_c > form > div > input[type=password]:nth-child(2)";
	const loginButtonSelector =
		"body > div.wrapper.main_wrapper.t_c > div.login_container.p_10.t_c > form > div > button";
	const userInputElement = await page.$(userInputSelector);
	const passwordInputElement = await page.$(passwordInputSelector);
	const loginButtonElement = await page.$(loginButtonSelector);
	if (userInputElement && passwordInputElement && loginButtonElement) {
		await userInputElement.fill(process.env.SEGA_USER_NAME || "");
		await passwordInputElement.fill(process.env.SEGA_PASSWORD || "");
		await loginButtonElement.click();
	} else {
		console.log("Input element not found");
		throw new Error("Input element not found");
	}

	// aime選択ページまたはエラーページになるまで待つ
	const aimeListPageUrl = "https://ongeki-net.com/ongeki-mobile/aimeList/";
	const errorPageUrl = "https://ongeki-net.com/ongeki-mobile/error/";
	while (true) {
		const url = await page.url();
		if (url === errorPageUrl) {
			throw new Error("Login failed");
		}
		if (url === aimeListPageUrl) {
			break;
		}
		await sleep(100);
	}

	// アクセス過多を避けるため一旦待つ
	await sleep(3000);

	// aimeを選択
	const aimeSelectButtonSelector =
		"body > div.wrapper.main_wrapper.t_c > div.aime_main_container > div.aime_main_block > form > button";
	const aimeSelectButtonElement = await page.$(aimeSelectButtonSelector);
	if (aimeSelectButtonElement) {
		await aimeSelectButtonElement.click();
	} else {
		throw new Error("Aime select button not found");
	}
	await page.context().storageState({ path: authFile });
	await sleep(1000);
	await browser.close();

	// ホームをAuth情報付きで再度開く
	const homeUrl = "https://ongeki-net.com/ongeki-mobile/home/";
	const browser2 = await chromium.launch({ headless: false });
	const context2 = await browser2.newContext({ storageState: authFile });
	const page2 = await context2.newPage();
	await page2.goto(homeUrl);

	await sleep(3000);

	// ブラウザを閉じる
	await browser2.close();
}
