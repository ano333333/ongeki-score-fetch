<template>
    <!-- TODO:何故かspanの色が全く変わらない -->
    <div class="rounded-md border border-gray-200 m-2 p-2">
        <span :class="iconClass">{{ iconString }}</span>
        <slot />
    </div>
</template>
<script setup lang="ts">
import { defineProps, computed } from "vue";
const props = defineProps<{
    type: "success" | "error";
}>();
const iconClassBase = [
    "rounded-full",
    "border",
    "px-2",
    "py-1",
    "font-medium",
    "m-1",
];
const iconClass = computed(() => {
    let color = "";
    switch (props.type) {
        case "success":
            color = "green";
            break;
        case "error":
            color = "red";
            break;
    }
    return [...iconClassBase, `text-${color}-700`, `border-${color}-400`];
});
const iconString = computed(() => {
    switch (props.type) {
        case "success":
            return "✓";
        case "error":
            return "✕";
    }
});
</script>
