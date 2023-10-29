import localStorageClass from "./scripts/utils/localStorageClass";
import messageToBackgroundType from "./scripts/utils/messageToBackgroundType";
import logicClass from "./scripts/utils/logicClass";
import runtimeMessageType from "./scripts/utils/runtimeMessageType";

//offscreenからのメッセージを受け取る
chrome.runtime.onMessage.addListener((message: runtimeMessageType) => {
    if (message.target !== "background") return;
    if (message.type === "log") {
        console.log(`offscreenからのメッセージ:${message.message}`);
    }
});

localStorageClass.addListener(
    "toBackground",
    (messages: messageToBackgroundType[]) => {
        if (messages.length !== 0) {
            const message = messages.pop()!;
            console.log(`message to background`);
            console.log(message);
            localStorageClass.set({ toBackground: messages }).then(async () => {
                if (message.type === "triggerLogic") {
                    await logicClass.fetchAndWriteData();
                } else if (message.type === "loginInfoCheck") {
                    const check = await logicClass.isLoginInfoValid();
                    localStorageClass.set({ loginInfoCheck: check });
                    console.log(`loginInfoCheck: ${check}`);
                }
            });
        }
    }
);
