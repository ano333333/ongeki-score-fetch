import dropboxStorageDataType from "./dropboxStorageDataType";
import { logicProgressType } from "./logicProgressType";
import { optionDataType, outputType } from "./optionDataType";

// type localStorageType = {
//     logicProgress: logicProgressType[];
//     optionData: optionDataType;
//     dropboxData: dropboxStorageDataType;
// };

export default class localStorageClass {
    public static async getOptionData() {
        const defaultOption = {
            outputType: outputType.download,
            outputPath: "ongeki-score-fetch/data.csv",
        };
        return (await this.get<optionDataType>("optionData")) ?? defaultOption;
    }
    public static async setOptionData(data: optionDataType) {
        await this.set({
            optionData: data,
        });
    }
    public static async getLogicProgress() {
        return (await this.get<logicProgressType[]>("logicProgress")) ?? [];
    }
    public static async appendLogicProgress(progress: logicProgressType) {
        const progresses =
            (await this.get<logicProgressType[]>("logicProgress")) ?? [];
        await this.set({
            logicProgress: [...progresses, progress],
        });
    }
    public static async clearLogicProgress() {
        await this.set({
            logicProgress: [],
        });
    }
    //進捗状況から、現在処理中かどうか判定する
    public static async isLogicProcessing() {
        const progresses = await localStorageClass.get<logicProgressType[]>(
            "logicProgress"
        );
        if (progresses) {
            return progresses[progresses.length - 1].type === "progress";
        } else {
            return false;
        }
    }
    public static addLogicProgressListener(callback: () => void) {
        this.addListener<logicProgressType[]>("logicProgress", () => {
            callback();
        });
    }
    public static async getDropboxData() {
        return await this.get("dropboxData");
    }
    public static async setDropboxData(data: dropboxStorageDataType) {
        await this.set({
            dropboxData: data,
        });
    }
    private static get<T>(key: string) {
        return new Promise<T | undefined>((resolve, reject) => {
            try {
                chrome.storage.local.get(key, (result) => {
                    resolve(
                        result.hasOwnProperty(key)
                            ? (result[key] as T)
                            : undefined
                    );
                });
            } catch (e) {
                reject(e);
            }
        });
    }
    private static set(items: { [key: string]: any }) {
        return new Promise<void>((resolve, reject) => {
            try {
                chrome.storage.local.set(items, () => {
                    resolve();
                });
            } catch (e) {
                reject(e);
            }
        });
    }
    private static addListener<T>(
        key: string,
        callback: (newValue: T, oldValue: T) => void
    ) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local") {
                return;
            }
            if (changes.hasOwnProperty(key)) {
                const { newValue, oldValue } = changes[key];
                callback(newValue, oldValue);
            }
        });
    }
}
