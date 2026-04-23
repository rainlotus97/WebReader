<!-- src/components/ConfirmBox.vue -->
<template>
  <Transition name="fade">
    <div v-if="visible" class="confirm-box-overlay" @click="handleOverlayClick">
      <div class="confirm-box" @click.stop>
        <div class="confirm-box-content">
          <p>{{ message }}</p>
        </div>
        <div class="confirm-box-actions">
          <button class="cancel-btn" @click="cancel">取消</button>
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
let resolveCallback: ((value: boolean) => void) | null = null

function show(msg: string): Promise<boolean> {
  message.value = msg
  visible.value = true
  return new Promise((resolve) => {
    resolveCallback = resolve
  })
}

function confirm() {
  visible.value = false
  if (resolveCallback) {
    resolveCallback(true)
    resolveCallback = null
  }
}

function cancel() {
  visible.value = false
  if (resolveCallback) {
    resolveCallback(false)
    resolveCallback = null
  }
}

function handleOverlayClick() {
  cancel()
}

defineExpose({ show })
</script>

<style scoped>
.confirm-box-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.confirm-box {
  min-width: 280px;
  max-width: 80%;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
.confirm-box-content {
  padding: 24px 20px;
  text-align: center;
  font-size: 16px;
  color: #333;
}
.confirm-box-actions {
  display: flex;
  border-top: 1px solid #eee;
}
.confirm-box-actions button {
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
.cancel-btn {
  color: #868e96;
  border-right: 1px solid #eee;
}
.confirm-btn:active, .cancel-btn:active {
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