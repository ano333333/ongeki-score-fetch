import type {
	IUserDataSource,
	UserDataScoreDifficultyType,
	UserDataScoreType,
} from "./base";

export class OngekiMypageUserDataSource implements IUserDataSource {
	async getUserData(
		logger: (message: string) => Promise<void>,
	): Promise<UserDataScoreType[]> {
		await logger("スコアデータ取得開始");
		const difs: [UserDataScoreDifficultyType, number][] = [
			["BASIC", 0],
			["ADVANCED", 1],
			["EXPERT", 2],
			["MASTER", 3],
			["LUNATIC", 10],
		];
		const scoreDatas: UserDataScoreType[] = [];
		for (const dif of difs) {
			const url = `https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=${dif[1]}`;
			const response = await this.fetch(url);
			const html = await response.text();
			const scoreData = await this.parseScoreHTML(html, dif[0]);
			scoreDatas.push(...scoreData);
			await logger(`${dif[0]}のユーザースコアデータ取得完了`);
			await this.sleep(5000);
		}
		await logger("全ユーザースコアデータ取得完了");
		return scoreDatas;
	}

	private async fetch(url: string) {
		const headers = this.createHeaders();
		return await fetch(url, {
			headers,
			credentials: "include",
		});
	}

	private createHeaders() {
		const header = new Headers();
		header.append(
			"Accept",
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
		);
		header.append("Accept-Encoding", "gzip, deflate, br");
		header.append("Accept-Language", "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7");
		header.append("Connection", "keep-alive");
		header.append("Host", "ongeki-net.com");
		header.append(
			"Referer",
			"https://ongeki-net.com/ongeki-mobile/record/musicGenre/",
		);
		header.append("Sec-Fetch-Dest", "document");
		header.append("Sec-Fetch-Mode", "navigate");
		header.append("Sec-Fetch-Site", "same-origin");
		header.append("Sec-Fetch-User", "?1");
		header.append("Upgrade-Insecure-Requests", "1");
		header.append(
			"User-Agent",
			"Mozilla/5.0 (Linux; Android 11; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Mobile Safari/537.36",
		);
		return header;
	}

	/**
	 * recordsページのHTMLを受け取り、楽曲データを返す
	 * @param html
	 * @param dif
	 * @returns
	 */
	private async parseScoreHTML(
		html: string,
		dif: UserDataScoreDifficultyType,
	): Promise<UserDataScoreType[]> {
		const domparser = new DOMParser();
		const doc = domparser.parseFromString(html, "text/html");
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
			null,
		).singleNodeValue;
		if (divParent === null) {
			throw new Error("HTML Parse Error");
		}
		const datas: UserDataScoreType[] = [];
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
					 *   - table(table0,未プレイならばこの要素は存在しない)
					 *     - tbody(table0tbody)
					 *       - tr
					 *       - tr(table0tbodytr1)
					 *         - td(table0tbodytr1td0,innerText=OVER DAMAGEの%表示 250.84%など)
					 *         - td(table0tbodytr1td1,innerText=BATTLE HIGH SCOREの%表示 9,367,060など)
					 *         - td(table0tbodytr1td2,innerText=TECHNICAL HIGH SCOREの3桁おきカンマ区切り表示 1,008,956)
					 *   - div(div1,未プレイならばこの要素は存在しない)
					 *     - table(div1table0)
					 *       - tbody(div1table0tbody)
					 *         - tr
					 *         - tr(div1table0tbodytr1)
					 * 		     - td(div1table0tbodytr1td0)
					 *             - div#platinum_high_score_star_block(div1table0tbodytr1td0div0,プラチナスコアの星を獲得していなければこの要素は存在しない)
					 *               - div(div1table0tbodytr1td0div0div0,虹星の場合のみクラス名が"platinum_score_star_r_block_s")
					 *               - div(div1table0tbodytr1td0div0div1,innerText=platinumStar)
					 *             - div#platinum_high_score_text_block(div1table0tbodytr1td0div1,innerText=platinumHighScore/platinumMaxScore 1,462 / 1,536)
					 *     - div(div1div0)
					 *       - img(可良優秀)
					 *       - img(ランク)
					 *       - img(div1div0img2
					 *           FBならばsrcがhttps://ongeki-net.com/ongeki-mobile/img/music_icon_fb.png?ver=1.35.0
					 *           FBでなければsrcがhttps://ongeki-net.com/ongeki-mobile/img/music_icon_back.png)
					 *       - img(div1div0img3
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
					if (tables.length === 0 || formdivs.length === 1) {
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
							platinumHighScore: 0,
							platinumStar: 0,
							platinumMaxScore: 0,
						});
						continue;
					}
					const table0 = tables[0];
					const table0tbody = table0.getElementsByTagName("tbody")[0];
					const table0tbodytr1 = table0tbody.getElementsByTagName("tr")[1];
					const table0tbodytr1td0 =
						table0tbodytr1.getElementsByTagName("td")[0];
					const overDamageHighScoreStr = table0tbodytr1td0.textContent || "";
					//「%」を除去し、floatに変換
					const overDamageHighScore = Number.parseFloat(
						overDamageHighScoreStr.replace("%", ""),
					);
					const table0tbodytr1td1 =
						table0tbodytr1.getElementsByTagName("td")[1];
					const battleHighScoreStr = table0tbodytr1td1.textContent || "";
					//「,」を除去し、intに変換
					//("1,033,501" --replace-> "1033,501" --replace-> "1033501" --parseInt-> 1033501)
					const battleHighScore = Number.parseInt(
						battleHighScoreStr.replace(",", "").replace(",", ""),
					);
					const table0tbodytr1td2 =
						table0tbodytr1.getElementsByTagName("td")[2];
					const technicalHighScoreStr = table0tbodytr1td2.textContent || "";
					//「,」を除去し、intに変換
					const technicalHighScore = Number.parseInt(
						technicalHighScoreStr.replace(",", "").replace(",", ""),
					);
					const div1 = formdivs[1];
					const div1table0 = div1.getElementsByTagName("table")[0];
					const div1table0tbody = div1table0.getElementsByTagName("tbody")[0];
					const div1table0tbodytr1 =
						div1table0tbody.getElementsByTagName("tr")[1];
					const div1table0tbodytr1td0 =
						div1table0tbodytr1.getElementsByTagName("td")[0];
					const div1table0tbodytr1td0_phssbs =
						div1table0tbodytr1td0.getElementsByClassName(
							"platinum_high_score_star_block",
						);
					const div1table0tbodytr1td0div0: HTMLDivElement | null =
						div1table0tbodytr1td0_phssbs.length > 0
							? (div1table0tbodytr1td0_phssbs[0] as HTMLDivElement)
							: null;
					const div1table0tbodytr1td0div0divs =
						div1table0tbodytr1td0div0?.getElementsByTagName("div");
					let platinumStar = 0;
					if (
						div1table0tbodytr1td0div0divs &&
						div1table0tbodytr1td0div0divs.length > 0
					) {
						const div0 = div1table0tbodytr1td0div0divs[0];
						if (div0.className === "platinum_score_star_r_block_s") {
							platinumStar = 6;
						} else {
							const div1 = div1table0tbodytr1td0div0divs[1];
							platinumStar = Number(div1.textContent || "0");
						}
					}
					const div1table0tbodytr1td0div1 =
						div1table0tbodytr1td0.getElementsByClassName(
							"platinum_high_score_text_block",
						)[0];
					// "1,462 / 1,536" -> ["1,462", "1,536"] -> "1,462"
					const platinumHighScoreStr = (
						div1table0tbodytr1td0div1.textContent || ""
					).split("/")[0];
					// "1,462 / 1,536" -> ["1,462", "1,536"] -> "1,536"
					const platinumMaxScoreStr = (
						div1table0tbodytr1td0div1.textContent || ""
					).split("/")[1];
					// "1,462" -> "1462" -> 1462
					const platinumHighScore = Number.parseInt(
						platinumHighScoreStr.replace(",", ""),
					);
					// "1,536" -> "1536" -> 1536
					const platinumMaxScore = Number.parseInt(
						platinumMaxScoreStr.replace(",", ""),
					);
					const div1div0 = getDirectDivChildren(div1)[0];
					const div1imgs = div1div0.getElementsByTagName("img");
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
						platinumHighScore,
						platinumStar,
						platinumMaxScore,
					});
				}
			}
		}
		return datas;
	}
	private async sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
