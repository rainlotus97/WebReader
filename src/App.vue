<template>
  <div class="app-container">
    <Bookshelf v-if="currentPage === 'bookshelf'" @open-book="handleOpenBook" />
    <Reader v-else-if="currentPage === 'reader'" :book="selectedBook" @back="goBack" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Book } from '@/types'
import Bookshelf from './pages/Bookshelf.vue'
import Reader from './pages/Reader.vue'

const currentPage = ref<'bookshelf' | 'reader'>('bookshelf')
const selectedBook = ref<Book | null>(null)

// 处理打开书籍
function handleOpenBook(book: Book): void {
  selectedBook.value = book
  currentPage.value = 'reader'
}

// 返回书架
function goBack(): void {
  currentPage.value = 'bookshelf'
  selectedBook.value = null
}

// 监听全局事件用于兼容性（备选方案）
function handleNavigateEvent(event: any): void {
  if (event.detail.page === 'reader' && event.detail.book) {
    handleOpenBook(event.detail.book)
  } else if (event.detail.page === 'bookshelf') {
    goBack()
  }
}

onMounted(() => {
  window.addEventListener('navigate', handleNavigateEvent)
})

onUnmounted(() => {
  window.removeEventListener('navigate', handleNavigateEvent)
})
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
