/**
 * スタンダードコースのジャンル別レコードページ・MASTER譜面(`https://ongeki-net.com/ongeki-mobile/record/musicGenre/search/?genre=99&diff=3`)から、曲タイトルとそれに属するジャンルを取得する
 *
 * **同名の曲がある場合、後の曲で上書きされる**
 * @param html
 * @returns 曲タイトルをkey、ジャンルをvalueとするMap
 */
export function scrapeStdRecordGenreMasterPage(
	html: string,
): Map<string, string> {
	return new Map();
}
