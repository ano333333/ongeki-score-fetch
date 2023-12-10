import dataFetchClass from "./dataFetchClass";
import localStorageClass from "./localStorageClass";
import getOutputInterface from "./outputInterfaceFactory";

export default class logicClass {
    public static async fetchAndWriteData() {
        try {
            await localStorageClass.clearLogicProgress();
            await localStorageClass.appendLogicProgress({
                type: "progress",
                message: "開始",
            });
            const datas = await dataFetchClass.startFetching();
            await localStorageClass.appendLogicProgress({
                type: "progress",
                message: "データ取得完了",
            });
            console.log(datas);
            const outputClass = await getOutputInterface();
            await localStorageClass.appendLogicProgress({
                type: "progress",
                message: "出力開始",
            });
            await outputClass.output(datas);
            await localStorageClass.appendLogicProgress({
                type: "finish",
            });
        } catch (e) {
            if (e instanceof Error) {
                await localStorageClass.appendLogicProgress({
                    type: "error",
                    message: e.message,
                });
            } else {
                await localStorageClass.appendLogicProgress({
                    type: "error",
                    message: "不明なエラー",
                });
            }
        }
    }
    public static async isLoginInfoValid() {
        return await dataFetchClass.isLoginInfoValid();
    }
}
