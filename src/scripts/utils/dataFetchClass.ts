import { loginInfoKeys, loginInfoType } from "./loginInfoType";
import userScoreDataType from "./userScoreDataType";
import localStorageClass from "./localStorageClass";
import runtimeMessageType from "./runtimeMessageType";
import scoreConstDataType from "./scoreConstDataType";
import allScoreDataType from "./allScoreDataType";

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
        await localStorageClass.clearLogicProgress();
        await localStorageClass.appendLogicProgress({
            type: "progress",
            message: "スコアデータ取得開始",
        });
        const loginInfo = await this.fetchLoginInfo();
        await localStorageClass.appendLogicProgress({
            type: "progress",
            message: "ログイン情報取得完了",
        });
        //オンゲキnetから、ユーザーデータの取得
        const headers = this.getUserScoreFetchHeader(loginInfo);
        const difs: [string, number][] = [
            ["BASIC", 0],
            ["ADVANCED", 1],
            ["EXPERT", 2],
            ["MASTER", 3],
            ["LUNATIC", 10],
        ];
        const userDatas: userScoreDataType[] = [];
        for (const dif of difs) {
            const url = `https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=${dif[1]}`;
            const response = await fetch(url, {
                headers,
            });
            const html = await response.text();
            userDatas.push(...(await this.sendUserScoreHTML(dif[0], html)));
            await localStorageClass.appendLogicProgress({
                type: "progress",
                message: `${dif[0]}のスコアデータ取得完了`,
            });
            await this.sleep(5000);
        }
        await localStorageClass.appendLogicProgress({
            type: "progress",
            message: "全レベルのスコアデータ取得完了",
        });
        //ongeki score logから、譜面定数の取得
        const url = "https://ongeki-score.net/music";
        const response = await fetch(url);
        const html = await response.text();
        const scoreConsts = await this.sendScoreConstHTML(html);
        await localStorageClass.appendLogicProgress({
            type: "progress",
            message: "譜面定数取得完了",
        });
        //取得したデータを結合
        //scoreConstsを、keyが`${name}#${difficulty}`、valueがscoreConstDataTypeのMapに変換
        const scoreConstMap = new Map<string, scoreConstDataType>();
        for (const scoreConst of scoreConsts) {
            scoreConstMap.set(
                `${scoreConst.name}#${scoreConst.difficulty}`,
                scoreConst
            );
        }
        const allScoreDatas: allScoreDataType[] = userDatas.map((userData) => {
            const scoreConst = scoreConstMap.get(
                `${userData.name}#${userData.difficulty}`
            );
            return {
                ...userData,
                const: scoreConst?.const ?? undefined,
            };
        });
        return allScoreDatas;
    }
    //offscreenを開き、メッセージを送ってユーザーデータHTMLをDOMParseさせ、結果を受け取るとresolveする
    private static sendUserScoreHTML(diff: string, html: string) {
        return new Promise<userScoreDataType[]>(async (resolve, reject) => {
            await chrome.offscreen.createDocument({
                url: chrome.runtime.getURL("offscreen.html"),
                reasons: [chrome.offscreen.Reason.DOM_PARSER],
                justification: "for DOMParser",
            });
            console.log("created offscreen document");
            const message: runtimeMessageType = {
                target: "offscreen",
                type: "user_score_domparse_start",
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
    //offscreenを開き、メッセージを送って譜面定数HTMLをDOMParseさせ、結果を受け取るとresolveする
    private static sendScoreConstHTML(html: string) {
        return new Promise<scoreConstDataType[]>(async (resolve, reject) => {
            await chrome.offscreen.createDocument({
                url: chrome.runtime.getURL("offscreen.html"),
                reasons: [chrome.offscreen.Reason.DOM_PARSER],
                justification: "for DOMParser",
            });
            console.log("created offscreen document");
            const message: runtimeMessageType = {
                target: "offscreen",
                type: "score_const_domparse_start",
                html,
            };
            const response = await chrome.runtime.sendMessage(message);
            await chrome.offscreen.closeDocument();
            console.log("returned to main thread");
            if (response.type === "score_const_domparse_end") {
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
    private static getUserScoreFetchHeader(loginInfo: loginInfoType) {
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
    private static async sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
