<template>
    <div class="w-80">
        <div class="m-2">
            <Alert v-if="isProcessing" type="error">
                情報取得中です
            </Alert>
            <Alert v-else type="success">
                情報取得可能です
            </Alert>
        </div>
        <div class="m-2">
            <Button
                @click="onclick"
                :disabled="isProcessing"
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
import Alert from "./components/alert.vue";
import Button from "./components/button.vue";
import { ChrExtLocalStorage } from "../adapters/rawLocalStorage/chrExtLocalStorage";
import { ChrExtBacktroundWorker } from "../adapters/backgroundWorker/chrExtBacktroundWorker";

const controller = new PopupController(
    new LocalStorage(new ChrExtLocalStorage()),
    new ChrExtBacktroundWorker(),
    (newProgresses: LocalStorageType["progresses"]) => {
        progresses.value = newProgresses;
    },
);
onMounted(async () => {
    const progs = await controller.getLocalStorageProgresses();
    progresses.value = progs;
});

const progresses = ref<LocalStorageType["progresses"]>([]);
//処理中かどうか、progressesの最終要素が"progress"かどうかで判断
const isProcessing = computed(() => {
    const last = progresses.value.at(-1);
    if (!last) return false;
    return last.type === "progress";
});

const onclick = async () => {
    if (!isProcessing.value) {
        await controller.fetchAndOutputData();
    }
};
</script>
