<template>
    <div class="w-80">
        <alert v-if="!isUrlValid" type="error">
            オンゲキマイページを開いてください
        </alert>
        <alert v-if="!dataFetcher.isLoginInfoValid" type="error">
            ログイン情報が取得できません
        </alert>
        <alert v-if="isUrlValid && dataFetcher.isLoginInfoValid" type="success">
            情報取得可能です
        </alert>
    </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import alert from "./components/alert.vue";
import dataFetchClass from "./utils/dataFetchClass";

const isUrlValid = ref(false);
const dataFetcher = new dataFetchClass();

onMounted(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (t) => {
        if (
            t[0].url &&
            t[0].url.search("ongeki-net.com/ongeki-mobile/") !== -1
        ) {
            isUrlValid.value = true;
        }
    });
});

onMounted(() => {
    dataFetcher.fetchLoginInfo();
});
</script>
./utils/loginInfoType
