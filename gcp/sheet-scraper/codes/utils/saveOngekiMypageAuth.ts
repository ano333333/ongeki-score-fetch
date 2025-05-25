import { chromium } from "playwright";
import { sleep } from "./sleep";

const OngekiMypageLoginUrl = "https://ongeki-net.com/ongeki-mobile/";
const OngekiMypageAimeListUrl =
	"https://ongeki-net.com/ongeki-mobile/aimeList/";
const OngekiMypageErrorUrl = "https://ongeki-net.com/ongeki-mobile/error/";

const LoginUsernameInputSelector =
	"body > div.wrapper.main_wrapper.t_c > div.login_container.p_10.t_c > form > div > input[type=text]:nth-child(1)";
const LoginPasswordInputSelector =
	"body > div.wrapper.main_wrapper.t_c > div.login_container.p_10.t_c > form > div > input[type=password]:nth-child(2)";
const LoginButtonSelector =
	"body > div.wrapper.main_wrapper.t_c > div.login_container.p_10.t_c > form > div > button";
const AimeSelectButtonSelector =
	"body > div.wrapper.main_wrapper.t_c > div.aime_main_container > div.aime_main_block > form > button";

/**
 * ongeki-net.comのcookieを保存
 * @param userName
 * @param password
 * @param authFilePath 保存先のパス
 */
export async function saveOngekiMypageAuth(
	userName: string,
	password: string,
	authFilePath: string,
) {
	console.log("saveOngekiMypageAuth");
	const browser = await chromium.launch({
		headless: true,
	});
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(OngekiMypageLoginUrl);

	const usernameInputElement = await page.$(LoginUsernameInputSelector);
	const passwordInputElement = await page.$(LoginPasswordInputSelector);
	const loginButtonElement = await page.$(LoginButtonSelector);
	if (usernameInputElement && passwordInputElement && loginButtonElement) {
		await usernameInputElement.fill(userName);
		await passwordInputElement.fill(password);
		await loginButtonElement.click();
	} else {
		throw new Error();
	}

	// aime選択ページまたはエラーページになるまで待つ
	while (true) {
		const url = await page.url();
		if (url === OngekiMypageErrorUrl) {
			throw new Error();
		}
		if (url === OngekiMypageAimeListUrl) {
			break;
		}
		await sleep(100);
	}

	await sleep(1000);

	// aimeを選択
	const aimeSelectButtonElement = await page.$(AimeSelectButtonSelector);
	if (aimeSelectButtonElement) {
		await aimeSelectButtonElement.click();
	} else {
		throw new Error();
	}

	// ongeki-net.comのcookieを保存
	await page.context().storageState({ path: authFilePath });

	await browser.close();

	console.log("saveOngekiMypageAuth end");
	console.log(`${authFilePath} saved`);
}
