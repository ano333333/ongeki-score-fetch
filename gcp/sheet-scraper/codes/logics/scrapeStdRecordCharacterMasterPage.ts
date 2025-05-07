/**
 * スタンダードコースのキャラクター別レコードページ・MASTER譜面(`https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=3`)から、曲タイトルとそれに属するキャラクターを取得する
 *
 * **同名の曲がある場合、後の曲で上書きされる**
 * @param html
 * @returns 曲タイトルをkey、キャラクターをvalueとするMap
 */
export function scrapeStdRecordCharacterMasterPage(
	html: string,
): Map<string, string> {
	return new Map();
}
