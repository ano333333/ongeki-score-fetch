import { loginInfoKeys, loginInfoType } from "./loginInfoType";
import scoreDataType from "./scoreDataType";
import localStorageClass from "./localStorageClass";
import logicProgressType from "./logicProgressType";
import runtimeMessageType from "./runtimeMessageType";

export default class dataFetchClass {
    private static async fetchLoginInfo() {
        let loginInfo: loginInfoType = {};
        //ログイン情報をcookieから取得
        for (const name of loginInfoKeys) {
            const value = await this.fetchCookie(name);
            console.log(`cookie ${name}: ${value}`);
            if (value) {
                loginInfo = {
                    ...loginInfo,
                    [name]: value,
                };
            }
        }
        return loginInfo;
    }
    public static async isLoginInfoValid() {
        const loginInfo = await this.fetchLoginInfo();
        return (
            loginInfo !== undefined &&
            loginInfo._t !== undefined &&
            loginInfo.segaId !== undefined &&
            // loginInfo._ga_92875CKHN5 !== undefined &&
            loginInfo._gcl_au !== undefined &&
            loginInfo._gid !== undefined &&
            loginInfo.friendCodeList !== undefined &&
            loginInfo.userId !== undefined &&
            loginInfo._ga_WDQDR0Y1TP !== undefined &&
            loginInfo._ga !== undefined
        );
    }
    public static async startFetching() {
        try {
            await this.appendProgress({
                type: "progress",
                message: "スコアデータ取得開始",
            });
            const loginInfo = await this.fetchLoginInfo();
            await this.appendProgress({
                type: "progress",
                message: "ログイン情報取得完了",
            });
            const headers = this.getScoreFetchHeader(loginInfo);
            const difs: [string, number][] = [
                ["BASIC", 0],
                ["ADVANCED", 1],
                ["EXPERT", 2],
                ["MASTER", 3],
                ["LUNATIC", 10],
            ];
            const datas: scoreDataType[] = [];
            for (const dif of difs) {
                const url = `https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=${dif[1]}`;
                const response = await fetch(url, {
                    headers,
                });
                const html = await response.text();
                datas.push(...(await this.sendHTMLToOffscreen(dif[0], html)));
                await this.appendProgress({
                    type: "progress",
                    message: `${dif[0]}のスコアデータ取得完了`,
                });
                await this.sleep(1000);
            }
            await this.appendProgress({
                type: "finish",
            });
            return datas;
        } catch (e) {
            throw Error("スコアデータ解析でエラーが発生しました");
        }
    }
    //offscreenを開き、メッセージを送ってDOMParseさせ、結果を受け取るとresolveする
    private static sendHTMLToOffscreen(diff: string, html: string) {
        return new Promise<scoreDataType[]>(async (resolve, reject) => {
            await chrome.offscreen.createDocument({
                url: chrome.runtime.getURL("offscreen.html"),
                reasons: [chrome.offscreen.Reason.DOM_PARSER],
                justification: "for DOMParser",
            });
            console.log("created offscreen document");
            const message: runtimeMessageType = {
                target: "offscreen",
                type: "domparse_start",
                html,
                diff,
            };
            const response = await chrome.runtime.sendMessage(message);
            await chrome.offscreen.closeDocument();
            console.log("returned to main thread");
            if (response.type === "domparse_end") {
                resolve(response.datas);
            } else if (response.type === "domparse_error") {
                reject(response.error);
            }
        });
    }
    private static fetchCookie(name: string) {
        return new Promise((resolve: (value: string | undefined) => any) => {
            chrome.cookies.get(
                { url: "https://ongeki-net.com", name },
                (cookie) => {
                    const now = new Date();
                    if (
                        cookie &&
                        (!cookie.expirationDate ||
                            cookie.expirationDate > now.getTime() / 1000)
                    ) {
                        resolve(cookie.value);
                    } else {
                        resolve(undefined);
                    }
                }
            );
        });
    }
    private static getScoreFetchHeader(loginInfo: loginInfoType) {
        const header = new Headers();
        header.append(
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
        );
        header.append("Accept-Encoding", "gzip, deflate, br");
        header.append("Accept-Language", "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7");
        header.append("Connection", "keep-alive");
        header.append("Cookie", this.getCookieString(loginInfo));
        header.append("Host", "ongeki-net.com");
        header.append(
            "Referer",
            "https://ongeki-net.com/ongeki-mobile/record/musicGenre/"
        );
        header.append("Sec-Fetch-Dest", "document");
        header.append("Sec-Fetch-Mode", "navigate");
        header.append("Sec-Fetch-Site", "same-origin");
        header.append("Sec-Fetch-User", "?1");
        header.append("Upgrade-Insecure-Requests", "1");
        header.append(
            "User-Agent",
            "Mozilla/5.0 (Linux; Android 11; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Mobile Safari/537.36"
        );
        return header;
    }
    private static getCookieString(info: loginInfoType) {
        const v = info;
        // return `_t=${v._t}; segaId=${v.segaId}; _ga_92875CKHN5=${v._ga_92875CKHN5}; _gcl_au=${v._gcl_au}; _gid=${v._gid}; friendCodeList=${v.friendCodeList}; userId=${v.userId}; _ga_WDQDR0Y1TP=${v._ga_WDQDR0Y1TP}; _ga=${v._ga};`;
        return `_t=${v._t}; segaId=${v.segaId}; _gcl_au=${v._gcl_au}; _gid=${v._gid}; friendCodeList=${v.friendCodeList}; userId=${v.userId}; _ga_WDQDR0Y1TP=${v._ga_WDQDR0Y1TP}; _ga=${v._ga};`;
    }
    private static async appendProgress(progress: logicProgressType) {
        const progresses =
            (await localStorageClass.get<logicProgressType[]>(
                "logicProgress"
            )) ?? [];
        await localStorageClass.set({
            logicProgress: [...progresses, progress],
        });
    }
    private static async sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
