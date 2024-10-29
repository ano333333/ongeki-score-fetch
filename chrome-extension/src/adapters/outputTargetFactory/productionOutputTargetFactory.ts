import type { IOutputTargetFactory } from "./base";
import type {
	OutputTargetDataRowType,
	OutputTargetType,
} from "../outputTargetType";

type DropboxTokenIssueResponseType = {
	access_token: string;
	expires_in: number;
	token_type: "bearer";
	uid: string;
	account_id: string;
	scope: string;
};

export default class ProductionOutputTargetFactory
	implements IOutputTargetFactory
{
	// TODO: これをマジックナンバーにしているのはよくない。ダサい。
	private clientId = "5bx5uvxl8iqp60a";
	getDownloadOutputTarget(): OutputTargetType<void> {
		return async (datas) => {
			const csv = this.convertToCsv(datas);
			const url = `data:application/csv;charset=utf-8,${encodeURIComponent(csv)}`;

			chrome.downloads.download({
				url,
				filename: this.filename(),
			});
		};
	}
	getDropboxOutputTarget(): OutputTargetType<{
		outputPath: string;
		accessToken: string | undefined;
		expires: number | undefined;
	}> {
		return async (datas, option, logger) => {
			await logger("dropboxへの認証開始");
			let accessToken = "";
			let newExpires = undefined;
			if (
				option.accessToken &&
				option.expires &&
				option.expires > Math.floor(Date.now() / 1000)
			) {
				accessToken = option.accessToken;
			} else {
				const res = await this.executePKCEFlow();
				accessToken = res.accessToken;
				newExpires = res.expires;
			}
			await logger("dropboxへの認証完了");
			console.log(`path: ${option.outputPath}`);
			await this.saveToDropbox(
				accessToken,
				this.convertToCsv(datas),
				option.outputPath,
			);
			return {
				...option,
				accessToken,
				expires: newExpires ?? option.expires,
			};
		};
	}
	private convertToCsv(datas: OutputTargetDataRowType[]): string {
		const header = [
			"曲名",
			"難易度",
			"レベル",
			"譜面定数",
			"ジャンル",
			"テクニカルハイスコア",
			"オーバーダメージハイスコア",
			"バトルハイスコア",
			"All Break",
			"Full Bell",
		].join(",");
		const rows = datas.map((data) =>
			[
				`"${data.name}"`,
				data.difficulty,
				data.level,
				data.const ?? "",
				data.genre,
				data.technicalHighScore,
				data.overDamageHighScore,
				data.battleHighScore,
				data.allBreak,
				data.fullBell,
			].join(","),
		);
		return [header, ...rows].join("\n");
	}
	private filename(): string {
		const today = new Date();
		const year = today.getFullYear();
		const month = `${today.getMonth() + 1}`.padStart(2, "0");
		const date = `${today.getDate()}`.padStart(2, "0");
		return `ongeki-score-data-${year}-${month}-${date}.csv`;
	}

	/**
	 * S256でcode challengeとcode verifierを生成
	 * @returns code_verifierとcode_challenge
	 */
	private async generateCodeVerifier() {
		// 正規表現「[0-9a-zA-Z\-\.\_\~], {43,128}」に基づくランダム文字列
		// 文字の種類は10+26+26+4=66種類
		// 0 ~ 65の乱数を128回生成
		const codeVerifier = [...Array(128)]
			.map(() => Math.floor(Math.random() * 66))
			.map(
				(n) =>
					"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-._~"[
						n
					],
			)
			.join("");
		// S256Hash
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(codeVerifier),
		);
		// base64url変換
		const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
			.replace(/=/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");
		return { codeVerifier, codeChallenge };
	}

	/**
	 * dropboxの認証ページを開き、authorization codeを取得
	 * @param codeChallenge code challenge
	 * @returns authorization code
	 */
	private waitForAuthorize(codeChallenge: string) {
		const url = "https://www.dropbox.com/oauth2/authorize";
		const params = {
			client_id: this.clientId,
			response_type: "code",
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
			redirect_uri: `chrome-extension://${chrome.runtime.id}/redirect.html`,
		};
		// dropboxの認証ページをポップアップウィンドウで開く
		return chrome.windows
			.create({
				url: `${url}?${new URLSearchParams(params)}`,
				type: "popup",
				width: 600,
				height: 800,
			})
			.then((window) => {
				// ポップアップウィンドウのタブIDを取得
				const tabId = window.tabs?.[0]?.id;
				if (!tabId) {
					throw "認証ページのタブIDの取得に失敗しました";
				}
				// ポップアップウィンドウがこの拡張機能のリダイレクトページに行くまで待つ
				return new Promise<string>((resolve, reject) => {
					// 拡張機能のリダイレクトページに行く前にこのウィンドウが閉じられたらエラー
					const removeListener = (windowId: number) => {
						if (windowId === window.id) {
							chrome.windows.onRemoved.removeListener(removeListener);
							chrome.tabs.onUpdated.removeListener(updateListener);
							reject("認証ウィンドウが閉じられました");
						}
					};
					chrome.windows.onRemoved.addListener(removeListener);
					const updateListener = (
						id: number,
						changeInfo: chrome.tabs.TabChangeInfo,
					) => {
						if (id === tabId && changeInfo.status === "loading") {
							const url = new URL(changeInfo.url ?? "");
							console.log(url);
							if (
								url.host === chrome.runtime.id &&
								url.pathname === "/redirect.html"
							) {
								// リダイレクトしたので、タブを閉じる
								chrome.tabs.remove(tabId);
								chrome.tabs.onUpdated.removeListener(updateListener);
								chrome.windows.onRemoved.removeListener(removeListener);
								const code = url.searchParams.get("code");
								// 認証ページでキャンセルが押されると、codeがnullになる
								if (!code) {
									reject("認証がキャンセルされました");
								} else {
									resolve(code);
								}
							}
						}
					};
					chrome.tabs.onUpdated.addListener(updateListener);
				});
			});
	}
	// authorization codeを用いてaccess tokenなど認証情報を取得
	private async issueToken(authorizationCode: string, codeVerifier: string) {
		const url = "https://api.dropboxapi.com/oauth2/token";
		const params = {
			code: authorizationCode,
			grant_type: "authorization_code",
			code_verifier: codeVerifier,
			// 実際にリダイレクトはしないが、ユーザー認証時に使用したリダイレクトと同じものであるかの確認のためdropbox側で使われる
			redirect_uri: `chrome-extension://${chrome.runtime.id}/redirect.html`,
			client_id: this.clientId,
		};
		const headers = {
			"Content-Type": "application/x-www-form-urlencoded",
		};
		// POST
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: new URLSearchParams(params),
		});
		const json = await response.json();
		console.log(JSON.stringify(json));
		// fetch失敗ならエラー
		if (!response.ok) {
			throw `dropboxへのアクセスに失敗しました。ステータスコード: ${response.status}`;
		}
		const responseData: DropboxTokenIssueResponseType = json;
		console.log(`response_data: ${JSON.stringify(responseData)}`);
		return responseData;
	}
	//認証からアクセストークン発行、ローカルに保存するまでのフローを実行する
	private async executePKCEFlow() {
		const { codeChallenge, codeVerifier } = await this.generateCodeVerifier();
		const authorizationCode = await this.waitForAuthorize(codeChallenge);
		console.log(`authorizationCode: ${authorizationCode}`);
		const token = await this.issueToken(authorizationCode, codeVerifier);
		console.log(`token: ${JSON.stringify(token)}`);
		const expires = Math.floor(Date.now() / 1000) + token.expires_in;
		return {
			accessToken: token.access_token,
			expires,
		};
	}

	private async saveToDropbox(accessToken: string, csv: string, path: string) {
		console.log("dropboxOutputClass.saveToDropbox");
		const url = "https://content.dropboxapi.com/2/files/upload";
		const headers = {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/octet-stream",
			"Dropbox-API-Arg": JSON.stringify({
				//オプション画面側では"/"始まりではないため、ここで付ける
				path: `/${path}`,
				mode: "overwrite",
				autorename: true,
				mute: false,
			}),
		};
		// POST
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: csv,
		});

		// fetch失敗ならエラー
		if (!response.ok) {
			console.log(response);
			throw `dropboxへのアクセスに失敗しました。ステータスコード: ${response.status}`;
		}
		return response.json();
	}
}
