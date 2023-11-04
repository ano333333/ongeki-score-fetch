import outputInterface from "./outputInterface";
import allScoreDataType from "./allScoreDataType";

class downloadOutputClass extends outputInterface {
    public static async output(datas: allScoreDataType[]) {
        console.log("downloadOutputClass.output");
        const csv = this.convertToCsv(datas);
        const url =
            "data:application/csv;charset=utf-8," + encodeURIComponent(csv);

        chrome.downloads.download({
            url,
            filename: this.filename(),
        });
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
    private static filename() {
        //今日の日付をYYYY-MM-DD形式で取得
        const today = new Date();
        const year = today.getFullYear();
        const month = ("0" + (today.getMonth() + 1)).slice(-2);
        const date = ("0" + today.getDate()).slice(-2);
        return `ongeki-score-data-${year}-${month}-${date}.csv`;
    }
}

export default downloadOutputClass;
