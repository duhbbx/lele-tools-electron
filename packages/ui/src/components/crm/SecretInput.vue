<script setup lang="ts">
import { ref } from 'vue'
import { copyText } from '../../clipboard'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const revealed = ref(false)

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="secret-input">
    <input
      :type="revealed ? 'text' : 'password'"
      :value="props.modelValue"
      class="input"
      autocomplete="off"
      @input="onInput"
    />
    <button type="button" class="icon-btn" title="显示/隐藏" @click="revealed = !revealed">
      {{ revealed ? '🙈' : '👁' }}
    </button>
    <button type="button" class="icon-btn" title="复制" @click="copyText(props.modelValue)">⧉</button>
  </div>
</template>

<style scoped lang="scss">
.secret-input {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 4px;

  .input {
    flex: 1;
    min-width: 0;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    opacity: 0.65;
    border-radius: 3px;
    line-height: 1;
    flex-shrink: 0;

    &:hover {
      opacity: 1;
      background: var(--border, #eee);
    }
  }
}
</style>
