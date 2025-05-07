/**
 * 楽曲別レコード・カテゴリ別ページ(`https://ongeki-net.com/ongeki-mobile/record/musicGenre/*`)から、セクション名とそれに属する曲タイトルを取得
 *
 * **同名の曲がある場合、後の曲で上書きされる**
 * @param html
 * @returns 曲タイトルをkey、セクション名をvalueとするMap
 */
export function scrapeStandardRecordPage(html: string): Map<string, string> {
	return new Map();
}
