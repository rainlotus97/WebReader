<template>
  <div class="bookshelf-container">
    <!-- 顶部操作栏 -->
    <div class="bookshelf-header">
      <h1 class="bookshelf-title">📚 书架</h1>
      <div class="header-actions">
        <div class="url-input-group">
          <input 
            v-model="urlInput" 
            type="text" 
            placeholder="请输入 GitHub 内容 URL"
            class="url-input"
            @keyup.enter="handleUrlUpload"
          />
          <button class="url-btn" @click="handleUrlUpload" :disabled="isProcessing">
            添加 URL
          </button>
        </div>
        <button class="upload-btn" @click="handleUploadClick" :disabled="isProcessing">
          <span class="upload-icon">📤</span> 上传文件
        </button>
        <button class="test-btn" @click="addTestBooks" :disabled="isProcessing" title="添加测试书籍">
          🧪
        </button>
        <button class="clear-btn" @click="clearCache" title="清除所有缓存书籍">
          🗑️
        </button>
      </div>
      <input
        ref="fileInput"
        type="file"
        multiple
        accept=".epub,.txt"
        style="display: none"
        @change="handleFileSelect"
      />
    </div>

    <!-- 书籍网格 -->
    <div class="bookshelf-content">
      <div v-if="books.length === 0" class="empty-state">
        <p class="empty-icon">📖</p>
        <p class="empty-text">还没有添加书籍，点击上面的按钮上传一本吧！</p>
      </div>

      <div v-else class="books-grid">
        <div
          v-for="book in books"
          :key="book.id"
          class="book-card"
          @click="openBook(book)"
        >
          <div class="book-cover">
            <div v-if="book.cover" class="cover-image">
              <img :src="book.cover" :alt="book.title" />
            </div>
            <div v-else class="cover-placeholder">
              <span class="book-icon">📖</span>
              <div class="placeholder-title">{{ book.title }}</div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getProgressPercent(book) + '%' }"></div>
            </div>
          </div>
          <div class="book-info">
            <h3 class="book-title">{{ book.title }}</h3>
            <p class="book-progress">
              <template v-if="book.fileType === 'epub'">
                进度: {{ getProgressPercent(book) }}%
              </template>
              <template v-else>
                {{ book.progress.chapter + 1 }} / {{ getTotalChapters(book.id) }}
              </template>
            </p>
          </div>
          <button class="delete-btn" @click.stop="deleteBook(book.id)">✕</button>
        </div>
      </div>
    </div>

    <!-- 上传进度提示 -->
    <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
      <div class="progress-bar-large">
        <div class="progress-fill-large" :style="{ width: uploadProgress + '%' }"></div>
      </div>
      <p>处理中... {{ uploadProgress }}%</p>
    </div>
    <MessageBox ref="messageBox" />
    <ConfirmBox ref="confirmBox" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Book, Chapter } from '@/types'
import { StorageManager } from '@/utils/storage'
import { EpubParser } from '@/utils/epub-parser'
import { TxtParser } from '@/utils/txt-parser'
import { generateId } from '@/utils/helpers'
import MessageBox from '@/components/MessageBox.vue'
import ConfirmBox from '@/components/ConfirmBox.vue'  // 新增
const confirmBox = ref<InstanceType<typeof ConfirmBox> | null>(null)  // 新增
// 定义事件
const emit = defineEmits<{
  'open-book': [book: Book]
}>()

const books = ref<Book[]>([])
const fileInput = ref<HTMLInputElement>()
const uploadProgress = ref(0)
const urlInput = ref('')
const isProcessing = ref(false)
const chapterCounts = ref<Map<string, number>>(new Map())

// 挂载时加载书籍列表
onMounted(() => {
  loadBooks()
})

// 加载书籍列表
async function loadBooks(): Promise<void> {
  books.value = await StorageManager.getAllBooks()
  // 加载每本书的章节数
  for (const book of books.value) {
    const chapters = await StorageManager.getBookContent(book.id)
    chapterCounts.value.set(book.id, chapters.length)
  }
}

// 打开文件选择对话框
function handleUploadClick(): void {
  fileInput.value?.click()
}

// 处理文件选择
async function handleFileSelect(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = input.files

  if (!files || files.length === 0) return

  isProcessing.value = true
  for (let i = 0; i < files.length; i++) {
    await processFile(files[i], Math.round(((i + 1) / files.length) * 100))
  }

  uploadProgress.value = 0
  isProcessing.value = false
  if (input) {
    input.value = ''
  }
}

const messageBox = ref<InstanceType<typeof MessageBox> | null>(null)

// 处理 URL 上传
async function handleUrlUpload(): Promise<void> {
  if (!urlInput.value.trim()) return

  let url = urlInput.value.trim()
  
  // 转换 GitHub URL 为 raw 内容 URL
  if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
    url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
  }

  isProcessing.value = true
  uploadProgress.value = 10

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('网络请求失败')
    
    const blob = await response.blob()
    const filename = url.split('/').pop() || 'unknown_book'
    const file = new File([blob], filename, { type: blob.type })
    
    await processFile(file, 100)
    urlInput.value = ''
  } catch (error) {
    console.error('URL upload failed:', error)
    if (messageBox.value) {
      await messageBox.value.show(`获取书籍失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } else {
      alert(`获取书籍失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  } finally {
    isProcessing.value = false
    uploadProgress.value = 0
  }
}

// 清除所有缓存
async function clearCache(): Promise<void> {
  if (confirmBox.value) {
    const ok = await confirmBox.value.show('确定要清除所有书籍和阅读记录吗？此操作不可恢复。')
    if (!ok) return
  } else {
    if (!confirm('确定要清除所有书籍和阅读记录吗？此操作不可恢复。')) return
  }
  await StorageManager.clearAll()
  books.value = []
  chapterCounts.value.clear()
}

// 添加测试书籍
async function addTestBooks(): Promise<void> {
  isProcessing.value = true
  const testFiles = [
    { name: 'test.txt', path: '/test.txt' }
  ]

  for (let i = 0; i < testFiles.length; i++) {
    try {
      uploadProgress.value = Math.round(((i + 1) / testFiles.length) * 100)
      const response = await fetch(testFiles[i].path)
      if (!response.ok) continue
      
      const blob = await response.blob()
      const file = new File([blob], testFiles[i].name, { type: blob.type })
      await processFile(file, uploadProgress.value)
    } catch (e) {
      console.error(`Failed to load test book ${testFiles[i].name}:`, e)
    }
  }
  
  isProcessing.value = false
  uploadProgress.value = 0
}

// 处理单个文件
async function processFile(file: File, progress: number): Promise<void> {
  try {
    uploadProgress.value = progress

    const fileType = file.name.toLowerCase().endsWith('.epub') ? 'epub' : 'txt'
    const bookId = generateId()

    // 解析文件
    let chapters: Chapter[] = []
    let bookTitle = file.name.replace(/\.(epub|txt)$/i, '')
    let bookCover: string | undefined = undefined

    if (fileType === 'epub') {
      const result = await EpubParser.parse(file)
      chapters = result.chapters
      bookTitle = result.metadata.title
      bookCover = result.metadata.cover
    } else {
      chapters = await TxtParser.parse(file)
    }

    // 创建书籍对象
    const book: Book = {
      id: bookId,
      title: bookTitle,
      filename: file.name,
      fileType,
      cover: bookCover,
      addedAt: Date.now(),
      progress: {
        chapter: 0,
        position: 0,
        timestamp: Date.now()
      }
    }

    // 保存书籍和内容
    await StorageManager.saveBook(book)
    if (fileType === 'epub') {
      await StorageManager.saveRawFile(bookId, file)
    }
    // 无论文件类型如何都保存章节内容，以便在加载书架时能够获取章节数并防止 crash
    await StorageManager.saveBookContent(bookId, chapters)
    chapterCounts.value.set(bookId, chapters.length)

    books.value.push(book)
  } catch (error) {
    console.error(`Failed to process file ${file.name}:`, error)
    alert(`处理文件 ${file.name} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 打开书籍
function openBook(book: Book): void {
  emit('open-book', book)
}

// 删除书籍
async function deleteBook(bookId: string): Promise<void> {
  if (confirmBox.value) {
    const ok = await confirmBox.value.show('确定要删除这本书吗？')
    if (!ok) return
  } else {
    // 降级处理，一般不会发生
    if (!confirm('确定要删除这本书吗？')) return
  }
  await StorageManager.deleteBook(bookId)
  books.value = books.value.filter(b => b.id !== bookId)
  chapterCounts.value.delete(bookId)
}

// 获取进度百分比
function getProgressPercent(book: Book): number {
  if (book.fileType === 'epub') {
    return Math.round(book.progress.position * 100)
  }
  const total = chapterCounts.value.get(book.id) || 1
  return Math.round(((book.progress.chapter + 1) / total) * 100)
}

// 获取总章节数
function getTotalChapters(bookId: string): string {
  const count = chapterCounts.value.get(bookId) || 0
  const book = books.value.find(b => b.id === bookId)
  if (book?.fileType === 'epub') {
    return 'EPUB'
  }
  return count.toString()
}
</script>

<style scoped>
.bookshelf-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
  color: #333;
  overflow: hidden;
}

.bookshelf-header {
  padding: 16px 24px;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.bookshelf-title {
  font-size: 24px;
  margin: 0;
  font-weight: 600;
  color: #1a1a1a;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.url-input-group {
  display: flex;
  background: #f1f3f5;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid #e9ecef;
}

.url-input {
  border: none;
  background: transparent;
  padding: 6px 12px;
  outline: none;
  width: 200px;
  font-size: 14px;
}

.url-btn {
  background: #4dabf7;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.url-btn:hover:not(:disabled) {
  background: #339af0;
}

.url-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.upload-btn {
  padding: 8px 16px;
  background: #4dabf7;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}

.upload-btn:hover:not(:disabled) {
  background: #339af0;
}

.test-btn, .clear-btn {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.test-btn:hover { background: #f8f9fa; border-color: #adb5bd; }
.clear-btn:hover { background: #fff5f5; border-color: #ffc9c9; }

.bookshelf-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 60vh;
  color: #adb5bd;
}

.empty-icon { font-size: 64px; margin: 0; }
.empty-text { font-size: 16px; margin-top: 16px; }

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 32px 24px;
}

.book-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.book-card:hover {
  transform: translateY(-4px);
}

.book-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 3/4;
  background: #e9ecef;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 12px;
}

.cover-image { width: 100%; height: 100%; }
.cover-image img { width: 100%; height: 100%; object-fit: cover; }

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #a5d8ff 0%, #74c0fc 100%);
  padding: 12px;
  text-align: center;
}

.placeholder-title {
  font-size: 14px;
  font-weight: bold;
  color: white;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 8px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.book-icon { font-size: 32px; color: rgba(255,255,255,0.8); }

.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  background: #4dabf7;
  transition: width 0.3s;
}

.book-info {
  display: flex;
  flex-direction: column;
}

.book-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #212529;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.book-progress {
  font-size: 12px;
  color: #868e96;
  margin: 0;
}

.delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background: rgba(255, 107, 107, 0.9);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.book-card:hover .delete-btn {
  opacity: 1;
}

.book-card:hover .delete-btn:hover {
  background: #ff6b6b;
  transform: scale(1.1);
}

.upload-progress {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  width: 320px;
  z-index: 100;
}

.progress-bar-large {
  width: 100%;
  height: 8px;
  background: #f1f3f5;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill-large {
  height: 100%;
  background: #4dabf7;
  transition: width 0.3s;
}

.upload-progress p {
  margin: 0;
  text-align: center;
  font-size: 14px;
  color: #666;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .bookshelf-header {
    padding: 16px;
  }

  .bookshelf-title {
    font-size: 22px;
  }

  .upload-btn {
    padding: 8px 16px;
    font-size: 14px;
  }

  .bookshelf-content {
    padding: 16px;
  }

  .books-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 480px) {
  .bookshelf-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .bookshelf-title {
    font-size: 20px;
  }

  .upload-btn {
    width: 100%;
    justify-content: center;
  }

  .bookshelf-content {
    padding: 12px;
  }

  .books-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
}
</style>
