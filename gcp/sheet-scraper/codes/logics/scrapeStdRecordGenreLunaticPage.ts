/**
 * スタンダードコースのジャンル別レコードページ・LUNATIC譜面(`https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=4`)から、曲タイトルとそれに属するジャンルを取得する
 *
 * **同名の曲がある場合、後の曲で上書きされる**
 * @param html
 * @returns 曲タイトルをkey、ジャンルをvalueとするMap
 */
export function scrapeStdRecordGenreLunaticPage(
	html: string,
): Map<string, string> {
	return new Map();
}
