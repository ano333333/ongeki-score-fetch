<template>
    <div>
        <h1 class="text-3xl font-bold underline">Hello World</h1>
    </div>
</template>
<script setup lang="ts">
import { onMounted } from "vue";

onMounted(() => console.log("mounted"));
</script>
