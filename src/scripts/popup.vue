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
            <table
                v-if="datas.length > 0"
                class="border-collapse border border-slate-400"
            >
                <thead>
                    <tr>
                        <th class="border border-slate-300 bg-gray-200">
                            曲名
                        </th>
                        <th class="border border-slate-300 bg-gray-200">
                            難易度
                        </th>
                        <th class="border border-slate-300 bg-gray-200">
                            スコア
                        </th>
                        <th class="border border-slate-300 bg-gray-200">AB</th>
                        <th class="border border-slate-300 bg-gray-200">FB</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="data in datas"
                        :key="`${data.name}_${data.difficulty}`"
                    >
                        <td class="border border-slate-300">{{ data.name }}</td>
                        <td class="border border-slate-300">
                            {{ data.difficulty }}
                        </td>
                        <td class="border border-slate-300">
                            {{ data.technicalHighScore }}
                        </td>
                        <td class="border border-slate-300">
                            {{ data.allBreak ? "O" : "X" }}
                        </td>
                        <td class="border border-slate-300">
                            {{ data.fullBell ? "O" : "X" }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import alert from "./components/alert.vue";
import buttonVue from "./components/button.vue";
import scoreDataType from "./utils/scoreDataType";
import runtimeMessageType from "./utils/runtimeMessageType";

const isUrlValid = ref(false);
const isProcessing = ref(false);
const isLoginInfoValid = ref(false);

const datas = ref<scoreDataType[]>([]);

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
        });
});
</script>
