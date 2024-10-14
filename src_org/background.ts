import logicClass from "./scripts/utils/logicClass";
import runtimeMessageType from "./scripts/utils/runtimeMessageType";

//offscreen,popupからのメッセージを受け取る
chrome.runtime.onMessage.addListener(
    (message: runtimeMessageType, _, sendResponse) => {
        if (message.target !== "background") return;
        if (message.type === "log") {
            console.log(`offscreenからのメッセージ:${message.message}`);
            return {};
        } else if (message.type === "trigger_logic") {
            console.log(`popupからのメッセージ:${message}`);
            logicClass.fetchAndWriteData();
            return {};
        } else if (message.type === "login_info_check") {
            console.log(`popupからのメッセージ:${message}`);
            logicClass.isLoginInfoValid().then((check) => {
                sendResponse({
                    target: "popup",
                    type: "login_info_result",
                    result: check,
                });
            });
            return true;
        }
    }
);
