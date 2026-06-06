<script setup lang="ts">
defineProps<{ refId: number }>()
defineEmits<{ rename: [title: string]; removed: [] }>()
</script>

<template>
  <div class="tool-page">project editor {{ refId }}</div>
</template>
