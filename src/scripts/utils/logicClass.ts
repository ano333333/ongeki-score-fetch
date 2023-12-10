import dataFetchClass from "./dataFetchClass";
import localStorageClass from "./localStorageClass";
import getOutputInterface from "./outputInterfaceFactory";

export default class logicClass {
    public static async fetchAndWriteData() {
        try {
            const datas = await dataFetchClass.startFetching();
            // TODO: スプレッドシートへの書き込みを実装するまでは、console.log
            console.log(datas);
            const outputClass = await getOutputInterface();
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
