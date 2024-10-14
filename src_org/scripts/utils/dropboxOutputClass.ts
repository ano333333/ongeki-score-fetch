import outputInterface from "./outputInterface";
import allScoreDataType from "./allScoreDataType";
import localStorageClass from "./localStorageClass";

type dropboxTokenIssueResponseType = {
    access_token: string;
    expires_in: number;
    token_type: "bearer";
    uid: string;
    account_id: string;
    scope: string;
};

//認証エラーを表す方
class AuthorizationError extends Error {}

class dropboxOutputClass extends outputInterface {
    public static async output(datas: allScoreDataType[]) {
        console.log("dropboxOutputClass.output");
        await localStorageClass.appendLogicProgress({
            type: "progress",
            message: "dropboxへの認証開始",
        });
        const accessToken =
            (await this.storedAccessToken()) ?? (await this.executePKCEFlow());
        await localStorageClass.appendLogicProgress({
            type: "progress",
            message: "dropboxへの認証完了",
        });
        console.log(
            `path: ${(await localStorageClass.getOptionData()).outputPath}`
        );
        await this.saveToDropbox(
            accessToken,
            this.convertToCsv(datas),
            (
                await localStorageClass.getOptionData()
            ).outputPath
        );
    }
    //local Storageに有効なaccess tokenがあればそれを返す
    private static async storedAccessToken() {
        const data = await localStorageClass.getDropboxData();
        if (data && data.expires > Math.floor(Date.now() / 1000)) {
            return data.access_token;
        }
        return undefined;
    }
    //S256でcode challengeとcode verifierを生成
    private static async generateCodeVerifier() {
        //正規表現「[0-9a-zA-Z\-\.\_\~], {43,128}」に基づくランダム文字列
        //文字の種類は10+26+26+4=66種類
        //0 ~ 65の乱数を128回生成
        const code_verifier = [...Array(128)]
            .map(() => Math.floor(Math.random() * 66))
            .map(
                (n) =>
                    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-._~"[
                        n
                    ]
            )
            .join("");
        //S256Hash
        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(code_verifier)
        );
        //base64url変換
        const code_challenge = btoa(
            String.fromCharCode(...new Uint8Array(digest))
        )
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");
        return { code_verifier, code_challenge };
    }
    //dropboxの認証ページを開き、authorization codeを取得
    private static waitForAuthorize(code_challenge: string) {
        const url = "https://www.dropbox.com/oauth2/authorize";
        const params = {
            client_id: this.client_id,
            response_type: "code",
            code_challenge,
            code_challenge_method: "S256",
            redirect_uri: `chrome-extension://${chrome.runtime.id}/redirect.html`,
        };
        //dropboxの認証ページをポップアップウィンドウで開く
        return chrome.windows
            .create({
                url: `${url}?${new URLSearchParams(params)}`,
                type: "popup",
                width: 600,
                height: 800,
            })
            .then((window) => {
                //ポップアップウィンドウのタブIDを取得
                const tabId = window.tabs![0].id!;
                //ポップアップウィンドウがこの拡張機能のリダイレクトページに行くまで待つ
                return new Promise<string>((resolve, reject) => {
                    //拡張機能のリダイレクトページに行く前にこのウィンドウが閉じられたらエラー
                    const removeListener = (windowId: number) => {
                        if (windowId === window.id) {
                            chrome.windows.onRemoved.removeListener(
                                removeListener
                            );
                            chrome.tabs.onUpdated.removeListener(
                                updateListener
                            );
                            reject(
                                new AuthorizationError(
                                    "認証ウィンドウが閉じられました"
                                )
                            );
                        }
                    };
                    chrome.windows.onRemoved.addListener(removeListener);
                    const updateListener = (id: number, changeInfo: any) => {
                        if (id === tabId && changeInfo.status === "loading") {
                            const url = new URL(changeInfo.url);
                            console.log(url);
                            if (
                                url.host === chrome.runtime.id &&
                                url.pathname === "/redirect.html"
                            ) {
                                //リダイレクトしたので、タブを閉じる
                                chrome.tabs.remove(tabId);
                                chrome.tabs.onUpdated.removeListener(
                                    updateListener
                                );
                                chrome.windows.onRemoved.removeListener(
                                    removeListener
                                );
                                const code = url.searchParams.get("code");
                                //認証ページでキャンセルが押されると、codeがnullになる
                                if (!code) {
                                    reject(
                                        new AuthorizationError(
                                            "認証がキャンセルされました"
                                        )
                                    );
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
    //authorization codeを用いてaccess tokenなど認証情報を取得
    private static async issueToken(
        authorization_code: string,
        code_verifier: string
    ) {
        const url = "https://api.dropboxapi.com/oauth2/token";
        const params = {
            code: authorization_code,
            grant_type: "authorization_code",
            code_verifier,
            //実際にリダイレクトはしないが、ユーザー認証時に使用したリダイレクトと同じものであるかの確認のためdropbox側で使われる
            redirect_uri: `chrome-extension://${chrome.runtime.id}/redirect.html`,
            client_id: this.client_id,
        };
        const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        };
        //POST
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: new URLSearchParams(params),
        });
        const json = await response.json();
        console.log(JSON.stringify(json));
        // fetch失敗ならエラー
        if (!response.ok) {
            throw new AuthorizationError(
                `dropboxへのアクセスに失敗しました。ステータスコード: ${response.status}`
            );
        }
        const response_data: dropboxTokenIssueResponseType = json;
        console.log(`response_data: ${JSON.stringify(response_data)}`);
        return response_data;
    }
    //認証からアクセストークン発行、ローカルに保存するまでのフローを実行する
    private static async executePKCEFlow() {
        const { code_challenge, code_verifier } =
            await this.generateCodeVerifier();
        const authorization_code = await this.waitForAuthorize(code_challenge);
        console.log(`authorization_code: ${authorization_code}`);
        const token = await this.issueToken(authorization_code, code_verifier);
        console.log(`token: ${JSON.stringify(token)}`);
        const expires = Math.floor(Date.now() / 1000) + token.expires_in;
        await localStorageClass.setDropboxData({
            access_token: token.access_token,
            expires,
        });
        return token.access_token;
    }
    private static convertToCsv(datas: allScoreDataType[]): string {
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
            ].join(",")
        );
        return [header, ...rows].join("\n");
    }
    private static async saveToDropbox(
        access_token: string,
        csv: string,
        path: string
    ) {
        console.log("dropboxOutputClass.saveToDropbox");
        const url = "https://content.dropboxapi.com/2/files/upload";
        const headers = {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
                //オプション画面側では"/"始まりではないため、ここで付ける
                path: "/" + path,
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
            throw new AuthorizationError(
                `dropboxへのアクセスに失敗しました。ステータスコード: ${response.status}`
            );
        }
        return response.json();
    }
    private static client_id = "5bx5uvxl8iqp60a";
}

export default dropboxOutputClass;
