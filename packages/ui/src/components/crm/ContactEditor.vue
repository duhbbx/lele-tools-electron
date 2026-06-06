<script setup lang="ts">
defineProps<{ refId: number }>()
defineEmits<{ rename: [title: string]; removed: [] }>()
</script>

<template>
  <div class="tool-page">contact editor {{ refId }}</div>
</template>
