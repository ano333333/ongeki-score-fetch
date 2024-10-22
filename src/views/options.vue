<template>
    <div class="m-4">
        <h1 class="m-2 text-lg">オプション</h1>
        <div v-if="!outputTargetOptions">
            <p class="text-gray-400">オプションデータを読み込み中</p>
        </div>
        <div v-else>
            <div class="m-2 p-4 border border-gray-400 rounded-md">
                <div class="m-2">
                    <label
                        for="outputType"
                        class="block text-sm font-medium leading-6"
                    >
                        出力方法
                    </label>
                    <div class="mt-2">
                        <select
                            id="outputType"
                            v-model="outputTarget"
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
                        v-model="outputTargetOptions.dropbox.outputPath"
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
import { LocalStorage, type LocalStorageType } from "../adapters/localStorage";
import { onMounted, ref, computed } from "vue";
import { OptionsController } from "../controllers/optionsController";
import { ChrExtLocalStorage } from "../adapters/rawLocalStorage/chrExtLocalStorage";

const controller = new OptionsController(
    new LocalStorage(new ChrExtLocalStorage()),
    updateIsProcessing,
);

const outputTarget = ref<LocalStorageType["outputTarget"]>("download");
const outputTargetOptions = ref<LocalStorageType["outputTargetOptions"]>({
    dropbox: {
        outputPath: "",
        accessToken: undefined,
        expires: undefined,
    },
});

const outputTypeList: { value: LocalStorageType["outputTarget"]; text: string }[] = [
    { value: "download", text: "ダウンロード" },
    { value: "dropbox", text: "Dropbox" },
];

const isProcessing = ref(true);
function updateIsProcessing(progresses: LocalStorageType["progresses"]) {
    const lastProgress = progresses.at(-1);
    isProcessing.value = lastProgress?.type === "progress";
};

onMounted(async () => {
    outputTarget.value = await controller.getOutputTarget();
    outputTargetOptions.value = await controller.getOutputTargetOptions();
    updateIsProcessing(await controller.getProgresses());
});

//「保存」ボタンのクリックイベント
const saveOnClick = () => {
    controller.setOutputTargetAndOptions(outputTarget.value, outputTargetOptions.value);
};

const isOutputPathValid = computed(() => {
    return controller.isOutputPathValid(outputTargetOptions.value.dropbox.outputPath);
});
</script>
