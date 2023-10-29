export default class localStorageClass {
    public static get<T>(key: string) {
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
    public static set(items: { [key: string]: any }) {
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
}
