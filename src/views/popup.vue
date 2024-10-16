<template>
    <div class="w-80">
        <div class="m-2">
            <Alert v-if="isFetchAvailable !== true" type="error">
                {{ isFetchAvailable }}
            </Alert>
            <Alert v-else type="success">
                情報取得可能です
            </Alert>
        </div>
        <div class="m-2">
            <Button
                @click="onclick"
                :disabled="isFetchAvailable !== true || isProcessing"
            >
                スコア情報取得
            </Button>
        </div>
        <div class="m-2">
            <div class="h-64 overflow-y-auto border rounded border-gray-500">
                <div
                    v-for="[index, progress] in progresses.entries()"
                    :key="index"
                    class="m-2"
                >
                    <p v-if="progress.type === 'progress'">
                        {{ progress.message }}
                    </p>
                    <p v-if="progress.type === 'finish'" class="text-green-400">
                        完了しました
                    </p>
                    <p v-if="progress.type === 'error'" class="text-red-400">
                        {{
                            "エラーが発生しました:" +
                            progress.message
                        }}
                    </p>
                    <hr v-if="index !== progresses.length - 1" />
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { LocalStorage, type LocalStorageType } from "../adapters/localStorage";
import { PopupController } from "../controllers/popupController";
import { MockUserDataSource } from "../adapters/userDataSource/MockUserDataSource";
import { MockBeatmapDataSource } from "../adapters/beatmapDataSource/mockBeatmapDataSource";
import { MockRawLocalStorage } from "../adapters/rawLocalStorage/mockRawLocalStorage";
import MockOutputTargetFactory from "../adapters/outputTargetFactory/mockOutputTargetFactory";

const popupController = ref<PopupController>();
onMounted(async () => {
    const userDataSource = new MockUserDataSource();
    const beatmapDataSource = new MockBeatmapDataSource();
    const rawLocalStorage = new MockRawLocalStorage();
    const localStorage = new LocalStorage(rawLocalStorage);
    const outputTargetFactory = new MockOutputTargetFactory();
    popupController.value = new PopupController(
        userDataSource,
        beatmapDataSource,
        localStorage,
        outputTargetFactory,
        progressesListener,
    );

    isFetchAvailable.value = await popupController.value.isUserDataFetchable();
    progresses.value = await localStorage.getProgresses();
});

const isFetchAvailable = ref<true|string>("");

const progresses = ref<LocalStorageType["progresses"]>([]);
//処理中かどうか、progressesの最終要素が"progress"かどうかで判断
const isProcessing = computed(() => {
    const last = progresses.value.at(-1);
    if (!last) return false;
    return last.type === "progress";
});
const progressesListener = (newProgresses: LocalStorageType["progresses"]) => {
    progresses.value = newProgresses;
};

const onclick = async () => {
    if(popupController.value && isFetchAvailable.value){
        await popupController.value.fetchAndOutputData();
    }
};
</script>
