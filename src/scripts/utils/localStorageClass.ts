import { logicProgressType } from "./logicProgressType";
import { optionDataType, outputType } from "./optionDataType";

// type localStorageType = {
//     logicProgress: logicProgressType[];
//     optionData: optionDataType;
// };

export default class localStorageClass {
    public static addListener<T>(
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
    public static async getOptionData() {
        const defaultOption = {
            outputType: outputType.download,
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
}
