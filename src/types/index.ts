// 书籍类型定义
export interface Book {
  id: string
  title: string
  filename: string
  fileType: 'epub' | 'txt'
  cover?: string
  addedAt: number
  progress: BookProgress
}

export interface BookProgress {
  chapter: number
  position: number
  timestamp: number
  cfi?: string // EPUB 专用定位符
}

// 章节类型定义
export interface Chapter {
  id: string
  title: string
  content: string
  index: number
}

// 阅读器状态
export interface ReaderState {
  currentBook: Book | null
  chapters: Chapter[]
  currentChapterIndex: number
  currentPosition: number
}
