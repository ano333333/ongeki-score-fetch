//DOMParserはbackground.tsでは使えないため、
//DOMParserを使う処理はoffscreen.tsに書く。
//background.tsからは、chrome.offscreen.createDocument -> chrome.runtime.sendMessageで起動
import scoreDataType from "./utils/scoreDataType";
import runtimeMessageType from "./utils/runtimeMessageType";

log("offscreen.ts loaded");

chrome.runtime.onMessage.addListener(function (
    message: runtimeMessageType,
    _,
    sendResponse
) {
    log("offscreen.ts received message");
    log(JSON.stringify(message));
    if (message.target !== "offscreen") return;
    if (message.type === "domparse_start") {
        const { html, diff } = message;
        parseRecordsHTML(diff, html)
            .then((datas) => {
                sendResponse({
                    type: "domparse_end",
                    diff,
                    datas,
                });
            })
            .catch((e) => {
                sendResponse({
                    type: "domparse_error",
                    diff,
                    error: e,
                });
            });
    } else {
        sendResponse({
            type: "domparse_error",
            diff: "",
            error: new Error("Invalid message type"),
        });
    }
    return true;
});

async function log(message: string) {
    console.log(message);
    chrome.runtime.sendMessage({
        target: "background",
        type: "log",
        message,
    });
}

//recordsページのHTMLを受け取り、楽曲データを返す
async function parseRecordsHTML(dif: string, html: string) {
    const { JSDOM } = await import("jsdom");
    const doc = new JSDOM(html).window.document;
    if (doc.getElementsByTagName("parseerror").length) {
        throw new Error("HTML Parse Error");
    }
    //XPATHからdiv要素を取得
    const divParentXpath = "/html/body/div[2]/div[5]";
    const divParent = doc.evaluate(
        divParentXpath,
        doc,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    ).singleNodeValue;
    if (divParent === null) {
        throw new Error("HTML Parse Error");
    }
    const datas: scoreDataType[] = [];
    let currnetGenre = "";
    //HTML要素を受け取り、その要素の直接のdiv子要素のみを返す
    const getDirectDivChildren = (parent: HTMLElement) => {
        const children = parent.getElementsByTagName("div");
        const directChildren: HTMLDivElement[] = [];
        for (const child of children) {
            if (child.parentElement === parent) {
                directChildren.push(child);
            }
        }
        return directChildren;
    };
    //divParentの子要素のうち、div要素のみをトラバース
    for (const child of divParent.childNodes) {
        if (child instanceof HTMLDivElement) {
            //class属性が「p_5 f_20」であれば、ジャンル表示
            if (child.className === "p_5 f_20") {
                currnetGenre = child.textContent || "";
            }
            //class属性が「t_l f_0」であれば、「マイリストGET!」の画像なので無視
            else if (child.className === "t_l f_0") {
                continue;
            }
            //それ以外であれば、楽曲データ
            else {
                /* 必要な情報に関わるDOM構成は以下の通り
                 * childが指し示すdiv要素
                 * - form
                 *   - div(div0)
                 *     - div(div0div0)
                 *       - img
                 *       - div(div0div0div0,innerText=レベル)
                 *     - img
                 * 　　- div(div0div1,innerText=楽曲名)
                 *   - table(table,未プレイならばこの要素は存在しない)
                 *     - tbody(tbody)
                 *       - tr
                 *       - tr(tr1)
                 *         - td(td0,innerText=OVER DAMAGEの%表示 250.84%など)
                 *         - td(td1,innerText=BATTLE HIGH SCOREの%表示 9,367,060など)
                 *         - td(td2,innerText=TECHNICAL HIGH SCOREの3桁おきカンマ区切り表示 1,008,956)
                 *   - div(div1)
                 *     - img(可良優秀)
                 *     - img(ランク)
                 *     - img(div1img2
                 *           FBならばsrcがhttps://ongeki-net.com/ongeki-mobile/img/music_icon_fb.png?ver=1.35.0
                 *           FBでなければsrcがhttps://ongeki-net.com/ongeki-mobile/img/music_icon_back.png)
                 *     - img(div1img3
                 *           ABならばsrcがhttps://ongeki-net.com/ongeki-mobile/img/music_icon_ab.png?ver=1.35.0
                 *           ABでなければsrcがhttps://ongeki-net.com/ongeki-mobile/img/music_icon_back.png)
                 */
                const form = child.getElementsByTagName("form")[0];
                const formdivs = getDirectDivChildren(form);
                //1階層下の子要素のみ取得する
                const div0 = formdivs[0];
                const div0divs = getDirectDivChildren(div0);
                const div0div0 = div0divs[0];
                //1階層下の子要素のみ取得する
                const div0div0div0 = div0div0.getElementsByTagName("div")[0];
                const level = div0div0div0.textContent || "";
                const div0div1 = div0divs[1];
                const name = div0div1.textContent || "";
                const tables = form.getElementsByTagName("table");
                //未プレイ
                if (tables.length === 0) {
                    datas.push({
                        difficulty: dif,
                        level,
                        name,
                        genre: currnetGenre,
                        technicalHighScore: 0,
                        overDamageHighScore: 0,
                        battleHighScore: 0,
                        fullBell: false,
                        allBreak: false,
                    });
                    continue;
                }
                const table = tables[0];
                const tbody = table.getElementsByTagName("tbody")[0];
                const tr1 = tbody.getElementsByTagName("tr")[1];
                const td0 = tr1.getElementsByTagName("td")[0];
                const overDamageHighScoreStr = td0.textContent || "";
                //「%」を除去し、floatに変換
                const overDamageHighScore = parseFloat(
                    overDamageHighScoreStr.replace("%", "")
                );
                const td1 = tr1.getElementsByTagName("td")[1];
                const battleHighScoreStr = td1.textContent || "";
                //「,」を除去し、intに変換
                //("1,033,501" --replace-> "1033,501" --replace-> "1033501" --parseInt-> 1033501)
                const battleHighScore = parseInt(
                    battleHighScoreStr.replace(",", "").replace(",", "")
                );
                const td2 = tr1.getElementsByTagName("td")[2];
                const technicalHighScoreStr = td2.textContent || "";
                //「,」を除去し、intに変換
                const technicalHighScore = parseInt(
                    technicalHighScoreStr.replace(",", "").replace(",", "")
                );
                const div1 = formdivs[1];
                const div1imgs = div1.getElementsByTagName("img");
                const fullBell = div1imgs[2].src.includes("fb");
                const allBreak = div1imgs[3].src.includes("ab");
                datas.push({
                    difficulty: dif,
                    level,
                    name,
                    genre: currnetGenre,
                    technicalHighScore,
                    overDamageHighScore,
                    battleHighScore,
                    fullBell,
                    allBreak,
                });
            }
        }
    }
    return datas;
}
