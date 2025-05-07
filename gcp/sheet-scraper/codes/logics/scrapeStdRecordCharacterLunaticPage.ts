/**
 * スタンダードコースのキャラクター別レコードページ・LUNATIC譜面(`https://ongeki-net.com/ongeki-mobile/record/musicCharacter/search/?chara=99&diff=10`)から、曲タイトルとそれに属するキャラクターを取得する
 *
 * **同名の曲がある場合、後の曲で上書きされる**
 * @param html
 * @returns 曲タイトルをkey、キャラクターをvalueとするMap
 */
export function scrapeStdRecordCharacterLunaticPage(
	html: string,
): Map<string, string> {
	return new Map();
}
