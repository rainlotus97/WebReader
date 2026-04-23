<template>
  <div class="reader-container" :style="containerStyle">
    <div v-if="isInitialLoading" class="reader-loading">
      <div class="loading-spinner"></div>
      <p>正在加载内容...</p>
    </div>

    <div class="reader-main" @click="handleViewportClick">
      <div class="reader-viewport">
        <!-- EPUB 渲染区域 -->
        <div v-show="book?.fileType === 'epub'" id="epub-viewer" class="epub-viewer"></div>
        <!-- EPUB 页码指示器 -->
        <div v-if="book?.fileType === 'epub' && hasEpubLocations" class="page-indicator">
          {{ epubCurrentPage }} / {{ epubTotalPages }}
        </div>

        <!-- TXT 渲染区域 -->
        <div v-if="book?.fileType === 'txt'" ref="txtViewerRef" class="txt-viewer">
          <div v-if="currentPageIndex === 0" class="chapter-title" :style="titleStyle">
            {{ currentChapter?.title }}
          </div>
          <div class="chapter-content-text" :style="contentStyle">
            {{ currentPageContent }}
          </div>
          <div class="page-indicator" v-if="totalPages > 1">
            {{ currentPageIndex + 1 }} / {{ totalPages }}
          </div>
        </div>

        <!-- 翻页区域 -->
        <div class="nav-zone prev" @click.stop="handlePrevPage"></div>
        <div class="nav-zone next" @click.stop="handleNextPage"></div>
        <div class="nav-zone center" @click.stop="toggleControls"></div>
      </div>

      <!-- 顶部控制栏 -->
      <transition name="slide-down">
        <div v-show="showControls" class="reader-header" @click.stop>
          <div class="header-left">
            <button class="icon-btn" @click="goBack"><span class="icon">←</span></button>
          </div>
          <div class="header-title">
            <h1 class="truncate">{{ book?.title }}</h1>
          </div>
          <div class="header-right">
            <button class="icon-btn" @click="toggleToc"><span class="icon">☰</span></button>
          </div>
        </div>
      </transition>

      <!-- 底部控制栏 -->
      <transition name="slide-up">
        <div v-show="showControls" class="reader-footer" @click.stop>
          <div class="footer-bottom">
            <button class="footer-tab" @click="toggleToc"><span class="tab-icon">☰</span><span>目录</span></button>
            <button class="footer-tab" @click="showSettings = true"><span
                class="tab-icon">Aa</span><span>设置</span></button>
          </div>
        </div>
      </transition>

      <!-- 设置面板 -->
      <transition name="fade">
        <div v-if="showSettings" class="settings-overlay" @click="showSettings = false">
          <div class="settings-panel" @click.stop>
            <div class="setting-item">
              <div class="setting-label">字号</div>
              <div class="font-controls">
                <button @click="adjustFontSize(-1)">A-</button>
                <span class="font-size-val">{{ settings.fontSize }}</span>
                <button @click="adjustFontSize(1)">A+</button>
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-label">背景</div>
              <div class="theme-controls">
                <div v-for="(t, key) in themes" :key="key" :class="['theme-opt', { active: settings.theme === key }]"
                  :style="{ backgroundColor: t.bg, color: t.color }" @click="settings.theme = key">
                  {{ t.name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- 目录抽屉 -->
      <transition name="slide-right">
        <div v-if="showToc" class="toc-drawer" @click="showToc = false">
          <div class="toc-content" @click.stop>
            <div class="toc-header">
              <h2>目录</h2><button class="close-btn" @click="showToc = false">✕</button>
            </div>
            <div class="toc-list">
              <template v-if="book?.fileType === 'epub'">
                <div v-for="(item, index) in epubToc" :key="index"
                  :class="['toc-item', { active: epubLocation?.includes(item.href) }]"
                  @click="goToChapter(index, item.href)">{{ item.title }}</div>
              </template>
              <template v-else>
                <div v-for="(chapter, index) in chapters" :key="chapter.id"
                  :class="['toc-item', { active: currentChapterIndex === index }]" @click="goToChapter(index)">{{
                    chapter.title }}</div>
              </template>
            </div>
          </div>
        </div>
      </transition>
    </div>
    <MessageBox ref="messageBox" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch, onUnmounted, shallowRef } from 'vue'
import MessageBox from '@/components/MessageBox.vue'
import type { Book, Chapter } from '@/types'
import { StorageManager } from '@/utils/storage'
import ePub, { Rendition, Book as EpubBook } from 'epubjs'

const messageBox = ref<InstanceType<typeof MessageBox> | null>(null)

const props = defineProps<{ book: Book | null }>()
const emit = defineEmits<{ back: [] }>()

// 基础数据
const chapters = ref<Chapter[]>([])
const currentChapterIndex = ref(0)
const showToc = ref(false)
const isInitialLoading = ref(true)
const showControls = ref(false)

// TXT 分页数据
const txtViewerRef = ref<HTMLElement | null>(null)
const currentPageIndex = ref(0)
const pagesContent = ref<string[]>([])
let resizeObserver: ResizeObserver | null = null

// 阅读设置
const settings = ref({
  fontSize: 20,
  lineHeight: 1.6,
  theme: 'default',
  fontFamily: 'system-ui'
})

const themes = {
  default: { bg: '#ffffff', color: '#333333', name: '明亮' },
  paper: { bg: '#f4f1ea', color: '#5f4b32', name: '羊皮纸' },
  green: { bg: '#e3f1e1', color: '#2c3e29', name: '护眼' },
  dark: { bg: '#1a1a1a', color: '#999999', name: '夜间' }
}

const showSettings = ref(false)

// EPUB 相关
let rendition: Rendition | null = null
const epubBook = shallowRef<EpubBook | null>(null)
const epubToc = ref<any[]>([])
const epubLocation = ref<string | null>(null)

// EPUB 页码相关
const epubCurrentPage = ref(1)
const hasEpubLocations = computed(() => {
  return epubBook.value && epubBook.value.locations && epubBook.value.locations.length() > 0
})
const epubTotalPages = computed(() => {
  return hasEpubLocations.value ? epubBook.value!.locations.length() : 0
})

// TXT 计算属性
const currentChapter = computed(() => chapters.value[currentChapterIndex.value])
const totalPages = computed(() => pagesContent.value.length)
const currentPageContent = computed(() => pagesContent.value[currentPageIndex.value] || '')

const containerStyle = computed(() => {
  const theme = themes[settings.value.theme as keyof typeof themes]
  return { backgroundColor: theme.bg, color: theme.color }
})

const titleStyle = computed(() => ({
  fontSize: `${settings.value.fontSize * 1.5}px`,
  marginBottom: '1.5em',
  fontWeight: 'bold',
  textAlign: 'center' as const
}))

const contentStyle = computed(() => ({
  fontSize: `${settings.value.fontSize}px`,
  lineHeight: String(settings.value.lineHeight),
  fontFamily: settings.value.fontFamily,
  textAlign: 'justify' as const,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const
}))

function adjustFontSize(delta: number): void {
  const newSize = settings.value.fontSize + delta
  if (newSize >= 12 && newSize <= 40) settings.value.fontSize = newSize
}

// ========== TXT 精确分页核心（保持不变） ==========
async function measureElementHeight(html: string, styleOverrides?: Partial<CSSStyleDeclaration>): Promise<number> {
  const div = document.createElement('div')
  div.style.position = 'absolute'
  div.style.top = '-9999px'
  div.style.left = '-9999px'
  div.style.visibility = 'hidden'
  div.style.width = getComputedStyle(txtViewerRef.value!).width
  div.style.padding = getComputedStyle(txtViewerRef.value!).padding
  const contentStyleObj = contentStyle.value as Record<string, string>
  Object.assign(div.style, {
    fontSize: contentStyleObj.fontSize,
    lineHeight: contentStyleObj.lineHeight,
    fontFamily: contentStyleObj.fontFamily,
    whiteSpace: contentStyleObj.whiteSpace,
    wordBreak: contentStyleObj.wordBreak,
    textAlign: contentStyleObj.textAlign
  })
  if (styleOverrides) Object.assign(div.style, styleOverrides)
  div.innerHTML = html
  document.body.appendChild(div)
  const height = div.clientHeight
  document.body.removeChild(div)
  return height
}

async function getTitleHeight(): Promise<number> {
  if (!currentChapter.value) return 0
  const titleHtml = `<div style="${Object.entries(titleStyle.value).map(([k, v]) => `${k}:${v}`).join(';')}">${currentChapter.value.title}</div>`
  return await measureElementHeight(titleHtml, { marginBottom: '1.5em' })
}

async function getPageIndicatorHeight(): Promise<number> {
  const indicatorHtml = '<div class="page-indicator" style="position:static; visibility:visible">1 / 1</div>'
  const div = document.createElement('div')
  div.style.position = 'absolute'
  div.style.top = '-9999px'
  div.style.left = '-9999px'
  div.style.visibility = 'hidden'
  div.innerHTML = indicatorHtml
  document.body.appendChild(div)
  const height = div.clientHeight
  document.body.removeChild(div)
  return height
}

async function extractTextForHeight(text: string, maxHeight: number): Promise<string> {
  if (!text) return ''
  let left = 0, right = text.length
  let best = 0
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const sub = text.slice(0, mid)
    const h = await measureElementHeight(sub)
    if (h <= maxHeight) {
      best = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  if (best === 0 && text.length > 0) best = 1
  return text.slice(0, best)
}

async function refreshPagination(): Promise<void> {
  if (props.book?.fileType !== 'txt' || !currentChapter.value?.content) return
  await nextTick()
  if (!txtViewerRef.value) return

  const viewportHeight = txtViewerRef.value.clientHeight
  if (viewportHeight <= 0) return

  const content = currentChapter.value.content
  const firstPageMaxHeight = viewportHeight - (await getPageIndicatorHeight()) - (await getTitleHeight())
  const otherPageMaxHeight = viewportHeight - (await getPageIndicatorHeight())

  let remaining = content
  const pages: string[] = []
  if (firstPageMaxHeight > 0 && remaining.length) {
    const firstPageText = await extractTextForHeight(remaining, firstPageMaxHeight)
    pages.push(firstPageText)
    remaining = remaining.slice(firstPageText.length)
  }
  while (remaining.length > 0) {
    const pageText = await extractTextForHeight(remaining, otherPageMaxHeight)
    pages.push(pageText)
    remaining = remaining.slice(pageText.length)
  }
  pagesContent.value = pages
  if (currentPageIndex.value >= pages.length) currentPageIndex.value = pages.length - 1
  if (currentPageIndex.value < 0) currentPageIndex.value = 0
  await saveProgressForTxt()
}

async function loadChapterPages(): Promise<void> {
  if (props.book?.fileType !== 'txt') return
  await refreshPagination()
  if (txtViewerRef.value) txtViewerRef.value.scrollTop = 0
}

async function nextPage(): Promise<void> {
  if (currentPageIndex.value + 1 < totalPages.value) {
    currentPageIndex.value++
    await saveProgressForTxt()
  } else if (currentChapterIndex.value + 1 < chapters.value.length) {
    currentChapterIndex.value++
    await loadChapterPages()
    currentPageIndex.value = 0
    await saveProgressForTxt()
  }
}

async function prevPage(): Promise<void> {
  if (currentPageIndex.value > 0) {
    currentPageIndex.value--
    await saveProgressForTxt()
  } else if (currentChapterIndex.value > 0) {
    currentChapterIndex.value--
    await loadChapterPages()
    currentPageIndex.value = totalPages.value - 1
    if (currentPageIndex.value < 0) currentPageIndex.value = 0
    await saveProgressForTxt()
  }
}

async function handleNextPage() {
  if (showToc.value) showToc.value = false
  if (props.book?.fileType === 'epub') rendition?.next()
  else await nextPage()
}

async function handlePrevPage() {
  if (showToc.value) showToc.value = false
  if (props.book?.fileType === 'epub') rendition?.prev()
  else await prevPage()
}

async function saveProgressForTxt(): Promise<void> {
  if (!props.book) return
  let position = totalPages.value > 0 ? currentPageIndex.value / totalPages.value : 0
  await StorageManager.updateBookProgress(props.book.id, currentChapterIndex.value, position, undefined)
}

async function restoreTxtProgress(book: Book): Promise<void> {
  const savedChapter = book.progress.chapter || 0
  if (savedChapter < chapters.value.length) currentChapterIndex.value = savedChapter
  else currentChapterIndex.value = 0
  await loadChapterPages()
  const savedPos = book.progress.position || 0
  let targetPage = Math.floor(savedPos * totalPages.value)
  targetPage = Math.min(targetPage, totalPages.value - 1)
  if (targetPage >= 0) currentPageIndex.value = targetPage
}

async function loadTxtBook(book: Book): Promise<void> {
  isInitialLoading.value = true
  chapters.value = await StorageManager.getBookContent(book.id)
  if (chapters.value.length) {
    await restoreTxtProgress(book)
  }
  isInitialLoading.value = false
  if (resizeObserver && txtViewerRef.value) resizeObserver.observe(txtViewerRef.value)
}

// ========== EPUB 相关（修正进度保存） ==========
async function initEpubReader(book: Book) {
  isInitialLoading.value = true
  if (epubBook.value) {
    epubBook.value.destroy()
    rendition = null
    epubBook.value = null
  }
  const rawFile = await StorageManager.getRawFile(book.id)
  if (!rawFile) {
    if (messageBox.value) await messageBox.value.show('无法加载文件')
    isInitialLoading.value = false
    return
  }
  try {
    const arrayBuffer = await rawFile.arrayBuffer()
    epubBook.value = ePub(arrayBuffer)
    await epubBook.value.ready
    const nav = await epubBook.value.loaded.navigation
    epubToc.value = nav.toc.map((item: any) => ({
      id: item.id,
      title: item.label,
      href: item.href.replace(/^\.\//, '')
    }))
    await nextTick()
    const container = document.getElementById('epub-viewer')
    if (!container) throw new Error('No container')
    rendition = epubBook.value.renderTo(container, {
      width: '100%',
      height: '100%',
      flow: 'paginated'
    })

    const applyEpubTheme = () => {
      const theme = themes[settings.value.theme as keyof typeof themes]
      if (!rendition) return
      rendition.themes.register('custom', {
        body: {
          'font-family': `${settings.value.fontFamily}, sans-serif`,
          'font-size': `${settings.value.fontSize}px`,
          'line-height': String(settings.value.lineHeight),
          color: theme.color,
          background: 'transparent'
        },
        p: { margin: '1em 0', 'text-indent': '2em' }
      })
      rendition.themes.select('custom')
    }
    applyEpubTheme()

    // 监听位置变化，保存进度（基于章节索引）
    rendition.on('relocated', (loc: any) => {
      epubLocation.value = loc.start.cfi
      // 计算当前章节索引
      const currentHref = loc.start.href
      const tocIndex = epubToc.value.findIndex(item => currentHref.includes(item.href))
      if (tocIndex !== -1) {
        // 基于章节索引的进度（0~1）
        const progress = tocIndex / (epubToc.value.length || 1)
        StorageManager.updateBookProgress(book.id, 0, progress, loc.start.cfi)
      } else if (epubToc.value.length > 0) {
        // fallback: 使用第一个章节
        StorageManager.updateBookProgress(book.id, 0, 0, loc.start.cfi)
      }
    })

    // 显示之前保存的进度（优先使用 CFI）
    try {
      if (book.progress.cfi) {
        await rendition.display(book.progress.cfi)
      } else {
        await rendition.display()
      }
    } catch (e) {
      console.warn('CFI display failed, using default start', e)
      await rendition.display()
    }

    isInitialLoading.value = false
  } catch (e) {
    console.error(e)
    if (messageBox.value) await messageBox.value.show('EPUB 加载失败')
    isInitialLoading.value = false
  }
}

// 字体/主题变化时，重新计算当前页码（仅当 locations 已就绪）
watch([() => settings.value.fontSize, () => settings.value.theme], async () => {
  if (props.book?.fileType === 'epub' && epubBook.value && rendition) {
    await nextTick()
    if (epubBook.value.locations && epubBook.value.locations.length() > 0 && epubLocation.value) {
      const percent = epubBook.value.locations.percentageFromCfi(epubLocation.value) || 0
      const total = epubBook.value.locations.length()
      epubCurrentPage.value = Math.min(Math.floor(percent * total) + 1, total)
    }
  } else if (props.book?.fileType === 'txt') {
    await refreshPagination()
  }
})

// 监听设置变化（字号、行高、字体、主题）
watch([() => settings.value.fontSize, () => settings.value.lineHeight, () => settings.value.fontFamily, () => settings.value.theme], async () => {
  if (props.book?.fileType === 'epub') {
    const theme = themes[settings.value.theme as keyof typeof themes]
    if (rendition) {
      (rendition.themes as any).update('custom', {
        body: {
          'font-size': `${settings.value.fontSize}px`,
          'line-height': String(settings.value.lineHeight),
          color: theme.color
        }
      })
    }
  } else if (props.book?.fileType === 'txt') {
    await refreshPagination()
  }
  localStorage.setItem('reader-settings', JSON.stringify(settings.value))
})

async function initReader(book: Book) {
  if (book.fileType === 'epub') await initEpubReader(book)
  else await loadTxtBook(book)
}

function goToChapter(index: number, href?: string) {
  if (props.book?.fileType === 'epub' && rendition && href) {
    rendition.display(href).then(() => showToc.value = false)
  } else if (props.book?.fileType === 'txt') {
    currentChapterIndex.value = index
    loadChapterPages().then(() => { currentPageIndex.value = 0; saveProgressForTxt(); showToc.value = false })
  }
}

function toggleToc() { showToc.value = !showToc.value; if (showToc.value) showControls.value = false }
function toggleControls() { showControls.value = !showControls.value }
function handleViewportClick() { if (showToc.value) showToc.value = false; else toggleControls() }

async function goBack() {
  if (props.book?.fileType === 'txt') await saveProgressForTxt()
  window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'bookshelf' } }))
}

function handleKeyPress(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    setTimeout(() => goBack().catch(err => {
      if (err?.message?.includes('No response')) return
      console.warn(err)
    }), 0)
    return
  }
  if (e.key === 'ArrowRight' || e.key === ' ') handleNextPage()
  else if (e.key === 'ArrowLeft' || e.key === 'Backspace') handlePrevPage()
}

watch(() => props.book, (newBook) => { if (newBook) initReader(newBook) }, { immediate: true })

onMounted(() => {
  const saved = localStorage.getItem('reader-settings')
  if (saved) try { settings.value = { ...settings.value, ...JSON.parse(saved) } } catch (e) { }
  window.addEventListener('keydown', handleKeyPress)
  window.addEventListener('resize', () => { if (props.book?.fileType === 'txt') refreshPagination() })
  if (window.ResizeObserver) resizeObserver = new ResizeObserver(() => { if (props.book?.fileType === 'txt') refreshPagination() })
})

onUnmounted(() => {
  if (epubBook.value) epubBook.value.destroy()
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', handleKeyPress)
})
</script>

<style scoped>
/* 此处样式与你原来的完全一致，保持不动 */
.reader-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  transition: background-color 0.3s, color 0.3s;
  user-select: none;
}

.reader-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
  background: inherit;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #4dabf7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.reader-main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.reader-viewport {
  flex: 1;
  position: relative;
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
}

.epub-viewer,
.txt-viewer {
  width: 100%;
  height: 100%;
  padding: 40px 20px;
  overflow-y: auto;
}

.txt-viewer {
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;
}

.page-indicator {
  position: absolute;
  bottom: 16px;
  right: 20px;
  font-size: 12px;
  opacity: 0.6;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 12px;
  pointer-events: none;
}

.nav-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 10;
}

.nav-zone.prev {
  left: 0;
  width: 30%;
}

.nav-zone.next {
  right: 0;
  width: 30%;
}

.nav-zone.center {
  left: 30%;
  width: 40%;
}

.reader-header,
.reader-footer {
  position: fixed;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  color: #333;
  z-index: 50;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.reader-header {
  top: 0;
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.header-title {
  flex: 1;
  text-align: center;
  padding: 0 12px;
}

.header-title h1 {
  font-size: 16px;
  margin: 0;
}

.reader-footer {
  bottom: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer-bottom {
  display: flex;
  justify-content: space-around;
  border-top: 1px solid #eee;
  padding-top: 12px;
}

.footer-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.tab-icon {
  font-size: 18px;
}

.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.settings-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 16px 16px 0 0;
  padding: 24px;
  color: #333;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.setting-label {
  width: 40px;
  font-size: 14px;
  color: #868e96;
}

.font-controls {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20px;
}

.font-controls button {
  flex: 1;
  height: 36px;
  border-radius: 18px;
  border: 1px solid #dee2e6;
  background: #f8f9fa;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.font-controls button:active {
  transform: scale(0.96);
}

.font-size-val {
  min-width: 40px;
  text-align: center;
  font-size: 16px;
}

.theme-controls {
  flex: 1;
  display: flex;
  gap: 12px;
}

.theme-opt {
  flex: 1;
  height: 36px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-opt.active {
  border-color: #4dabf7;
  transform: scale(0.98);
}

.toc-drawer {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.toc-content {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 80%;
  max-width: 300px;
  background: white;
  color: #333;
  display: flex;
  flex-direction: column;
}

.toc-header {
  padding: 16px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toc-header h2 {
  font-size: 18px;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.toc-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.toc-item {
  padding: 12px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.toc-item.active {
  color: #4dabf7;
  background: #f1f3f5;
}

.toc-item:hover {
  background: #f8f9fa;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(-100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  font-size: 20px;
  color: inherit;
  transition: opacity 0.2s;
}

.icon-btn:active {
  opacity: 0.6;
}

/* 夜间模式适配 */
.reader-container[style*="background-color: rgb(26, 26, 26)"] .reader-header,
.reader-container[style*="background-color: rgb(26, 26, 26)"] .reader-footer,
.reader-container[style*="background-color: rgb(26, 26, 26)"] .settings-panel,
.reader-container[style*="background-color: rgb(26, 26, 26)"] .toc-content {
  background: #252525;
  color: #999;
}

.reader-container[style*="background-color: rgb(26, 26, 26)"] .footer-tab,
.reader-container[style*="background-color: rgb(26, 26, 26)"] .font-controls button {
  background: #333;
  border-color: #444;
  color: #ccc;
}

.reader-container[style*="background-color: rgb(26, 26, 26)"] .toc-header,
.reader-container[style*="background-color: rgb(26, 26, 26)"] .footer-bottom {
  border-color: #333;
}

.reader-container[style*="background-color: rgb(26, 26, 26)"] .setting-label {
  color: #aaa;
}

.reader-container[style*="background-color: rgb(26, 26, 26)"] .toc-item.active {
  background: #3a3a3a;
  color: #6c9eff;
}

.reader-container[style*="background-color: rgb(26, 26, 26)"] .toc-item:hover {
  background: #2f2f2f;
}

.reader-container[style*="background-color: rgb(26, 26, 26)"] .page-indicator {
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
}
</style>