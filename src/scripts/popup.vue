<template>
    <div class="w-80">
        <div class="m-2">
            <alert v-if="!isUrlValid" type="error">
                オンゲキマイページを開いてください
            </alert>
        </div>
        <div class="m-2">
            <alert v-if="!isLoginInfoValid" type="error">
                ログイン情報が取得できません
            </alert>
        </div>
        <div class="m-2">
            <alert v-if="isUrlValid && isLoginInfoValid" type="success">
                情報取得可能です
            </alert>
        </div>
        <div class="m-2">
            <buttonVue
                @click="onclick"
                :disabled="!isUrlValid || !isLoginInfoValid || isProcessing"
            >
                スコア情報取得
            </buttonVue>
        </div>
        <div class="m-2">
            <div class="h-64 overflow-y-auto border rounded border-gray-500">
                <div
                    v-for="progress in progresses"
                    :key="progress.index"
                    class="m-2"
                >
                    <p v-if="progress.type === 'progress'">
                        {{ (progress as logicProgressTypeProgress).message }}
                    </p>
                    <p v-if="progress.type === 'finish'" class="text-green-400">
                        完了しました
                    </p>
                    <p v-if="progress.type === 'error'" class="text-red-400">
                        {{
                            "エラーが発生しました:" +
                            (progress as logicProgressTypeError).message
                        }}
                    </p>
                    <hr v-if="progress.index !== progresses.length - 1" />
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import alert from "./components/alert.vue";
import buttonVue from "./components/button.vue";
import runtimeMessageType from "./utils/runtimeMessageType";
import {
    logicProgressTypeError,
    logicProgressTypeProgress,
    logicProgressType,
} from "./utils/logicProgressType";
import localStorageClass from "./utils/localStorageClass";

const isUrlValid = ref(false);
const isLoginInfoValid = ref(false);

//表示の際のkey属性のために、idを持たせる
const progresses = ref<(logicProgressType & { index: number })[]>([]);
//処理中かどうか、progressesの最終要素が"progress"かどうかで判断
const isProcessing = computed(() => {
    if (progresses.value.length === 0) return false;
    return progresses.value[progresses.value.length - 1].type === "progress";
});

const onclick = async () => {
    chrome.runtime.sendMessage({
        target: "background",
        type: "trigger_logic",
    });
};

onMounted(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (t) => {
        if (!t[0] || !t[0].url) return;
        const url = t[0].url;
        // 「https://ongeki-net.com/ongeki-mobile/**/~~」の**の部分を取得
        // **が「home、record、event、collection、character、card、friend、ranking」のいずれかならばOK
        const urlRegex =
            /https:\/\/ongeki-net.com\/ongeki-mobile\/(home|record|event|collection|character|card|friend|ranking)\/.*/;
        isUrlValid.value = urlRegex.test(url);
    });
});

onMounted(() => {
    chrome.runtime
        .sendMessage({
            target: "background",
            type: "login_info_check",
        })
        .then((response: runtimeMessageType) => {
            if (response.type !== "login_info_result") return false;
            return response.result;
        })
        .then((result) => {
            isLoginInfoValid.value = result;
        })
        .catch();
});

onMounted(() => {
    copyLocalStorageLogicProgres();
});

//localStorageの"logicProgress"を監視し、progress.valueにコピー
localStorageClass.addListener<logicProgressType[]>("logicProgress", () => {
    copyLocalStorageLogicProgres();
});

//localStorageの"logicProgress"の値を、progresses.valueにコピー
const copyLocalStorageLogicProgres = () => {
    localStorageClass.getLogicProgress().then((value) => {
        console.log(value);
        if (!value) {
            progresses.value = [];
        } else {
            progresses.value = value.map((v, i) => ({
                ...v,
                index: i,
            }));
        }
    });
};
</script>
