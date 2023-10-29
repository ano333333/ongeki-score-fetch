import dataFetchClass from "./dataFetchClass";

export default class logicClass {
    public static async fetchAndWriteData() {
        const data = await dataFetchClass.startFetching();
        // TODO: スプレッドシートへの書き込みを実装するまでは、console.log
        console.log(data);
    }
    public static async isLoginInfoValid() {
        return await dataFetchClass.isLoginInfoValid();
    }
}
