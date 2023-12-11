<template>
    <div class="m-4">
        <h1 class="m-2 text-lg">オプション</h1>
        <div v-if="!optionData">
            <p class="text-gray-400">オプションデータを読み込み中</p>
        </div>
        <div v-else>
            <div class="m-2 p-4 border border-gray-400 rounded-md">
                <div class="m-2">
                    <label
                        for="outputType"
                        class="block text-sm font-medium leading-6"
                        >出力方法</label
                    >
                    <div class="mt-2">
                        <select
                            id="outputType"
                            v-model="optionData.outputType"
                            class="block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
                        >
                            <option
                                v-for="outputType in outputTypeList"
                                :key="outputType.value"
                                :value="outputType.value"
                            >
                                {{ outputType.text }}
                            </option>
                        </select>
                    </div>
                </div>
                <div class="m-2">
                    <label
                        for="outputPath"
                        class="block text-sm font-medium leading-6"
                        >出力先ファイルパス<br /><span
                            class="text-gray-400 leading-4"
                            >Dropboxに保存する際このパス・ファイル名で保存します</span
                        ></label
                    >
                    <input
                        v-model="optionData.outputPath"
                        id="outputPath"
                        type="text"
                        class="block w-full rounded-md border-0 px-1.5 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
                    />
                    <p
                        v-if="!isOutputPathValid"
                        class="text-sm mt-1 font-bold text-red-400"
                    >
                        パスが不正です。拡張子は.csvまたは.txtにしてください。
                    </p>
                </div>
            </div>
            <button
                :disabled="isProcessing"
                @click="saveOnClick()"
                class="m-2 p-2 border border-gray-400 rounded-md disabled:bg-gray-300"
            >
                保存
            </button>
            <p v-if="isProcessing" class="text-red-400 text-sm">
                データ取得中は更新できません
            </p>
        </div>
    </div>
</template>
<script setup lang="ts">
import localStorageClass from "./utils/localStorageClass";
import { optionDataType, outputType } from "./utils/optionDataType";
import { onMounted, ref, computed } from "vue";

const optionData = ref<optionDataType>({
    outputType: outputType.download,
    outputPath: "",
});

const outputTypeList = [
    { value: outputType.download, text: "ダウンロード" },
    { value: outputType.dropbox, text: "Dropbox" },
];

const isProcessing = ref(true);

onMounted(async () => {
    const data = await localStorageClass.getOptionData();
    optionData.value = data;
});

onMounted(() => {
    localStorageClass.isLogicProcessing().then((value) => {
        isProcessing.value = value;
    });
});

//localStorageを監視し、logicProgressに変更があればisProcessingを更新
onMounted(() => {
    localStorageClass.addLogicProgressListener(async () => {
        isProcessing.value = await localStorageClass.isLogicProcessing();
    });
});

//「保存」ボタンのクリックイベント
const saveOnClick = () => {
    if (optionData.value !== undefined) {
        localStorageClass.setOptionData(optionData.value);
    }
};

const isOutputPathValid = computed(() => {
    if (optionData.value === undefined) {
        return false;
    }
    //パスに使用できない文字が含まれていればfalse
    const unusable = /[\\:\*\?\"<>\|]/;
    if (optionData.value.outputPath.search(unusable) !== -1) {
        return false;
    }
    // \/ で始まっていればfalse
    if (optionData.value.outputPath.startsWith("/")) {
        return false;
    }
    //outputPathの拡張子が.csvまたは.txtでなければfalse
    const ext = optionData.value.outputPath.split(".").pop();
    if (ext !== "csv" && ext !== "txt") {
        return false;
    }
    return true;
});
</script>
