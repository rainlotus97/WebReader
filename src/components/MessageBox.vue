<!-- src/components/MessageBox.vue -->
<template>
  <Transition name="fade">
    <div v-if="visible" class="message-box-overlay" @click="handleOverlayClick">
      <div class="message-box" @click.stop>
        <div class="message-box-content">
          <p>{{ message }}</p>
        </div>
        <div class="message-box-actions">
          <button class="confirm-btn" @click="confirm">确定</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
let resolveCallback: (() => void) | null = null

function show(msg: string): Promise<void> {
  message.value = msg
  visible.value = true
  return new Promise((resolve) => {
    resolveCallback = resolve
  })
}

function confirm() {
  visible.value = false
  if (resolveCallback) {
    resolveCallback()
    resolveCallback = null
  }
}

function handleOverlayClick() {
  confirm()
}

defineExpose({ show })
</script>

<style scoped>
.message-box-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.message-box {
  min-width: 280px;
  max-width: 80%;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
.message-box-content {
  padding: 24px 20px;
  text-align: center;
  font-size: 16px;
  color: #333;
}
.message-box-actions {
  display: flex;
  border-top: 1px solid #eee;
}
.message-box-actions button {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.confirm-btn {
  color: #4dabf7;
}
.confirm-btn:active {
  background: #f1f3f5;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>