import dataFetchClass from "./dataFetchClass";
import localStorageClass from "./localStorageClass";
import { logicProgressType } from "./logicProgressType";
import getOutputInterface from "./outputInterfaceFactory";

export default class logicClass {
    public static async fetchAndWriteData() {
        try {
            const datas = await dataFetchClass.startFetching();
            // TODO: スプレッドシートへの書き込みを実装するまでは、console.log
            console.log(datas);
            const outputClass = await getOutputInterface();
            await outputClass.output(datas);
            await this.appendProgress({
                type: "finish",
            });
        } catch (e) {
            if (e instanceof Error) {
                await this.appendProgress({
                    type: "error",
                    message: e.message,
                });
            } else {
                await this.appendProgress({
                    type: "error",
                    message: "不明なエラー",
                });
            }
        }
    }
    public static async isLoginInfoValid() {
        return await dataFetchClass.isLoginInfoValid();
    }
    //localStorageに進捗を追加
    private static async appendProgress(progress: logicProgressType) {
        const progresses =
            (await localStorageClass.get<logicProgressType[]>(
                "logicProgress"
            )) ?? [];
        await localStorageClass.set({
            logicProgress: [...progresses, progress],
        });
    }
}
