<template>
    <button
        type="button"
        @click="emits('click')"
        :disabled="props.disabled"
        class="rounded-md px-2.5 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
    >
        <slot />
    </button>
</template>
<script setup lang="ts">
import { defineProps, defineEmits } from "vue";

const props = defineProps({
    disabled: {
        type: Boolean,
        default: false,
    },
});
const emits = defineEmits<{
    (e: "click"): void;
}>();
</script>
