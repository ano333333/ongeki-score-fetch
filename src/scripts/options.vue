<template>
    <div class="m-4">
        <h1 class="m-2 text-lg">オプション</h1>
        <div v-if="!optionData">
            <p class="text-gray-400">オプションデータを読み込み中</p>
        </div>
        <div v-else>
            <div class="m-2 p-4 border border-gray-400 rounded-md">
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
import { onMounted, ref } from "vue";

const optionData = ref<optionDataType>();

const outputTypeList = [{ value: outputType.download, text: "ダウンロード" }];

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
localStorageClass.addListener("logicProgress", () => {
    localStorageClass.isLogicProcessing().then((value) => {
        isProcessing.value = value;
    });
});

//「保存」ボタンのクリックイベント
const saveOnClick = () => {
    if (optionData.value !== undefined) {
        localStorageClass.setOptionData(optionData.value);
    }
};
</script>
