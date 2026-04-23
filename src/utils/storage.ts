import type { Book, Chapter } from '@/types'

const DB_NAME = 'WebReaderDB'
const DB_VERSION = 3
const STORE_BOOKS = 'books'
const STORE_CONTENTS = 'contents'
const STORE_RAW_FILES = 'raw_files'

/**
 * 本地存储管理 - 使用 IndexedDB 支持大容量存储
 */
export class StorageManager {
  private static db: IDBDatabase | null = null

  private static async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_CONTENTS)) {
          db.createObjectStore(STORE_CONTENTS, { keyPath: 'bookId' })
        }
        if (!db.objectStoreNames.contains(STORE_RAW_FILES)) {
          db.createObjectStore(STORE_RAW_FILES, { keyPath: 'bookId' })
        }
      }
    })
  }

  /**
   * 获取所有书籍
   */
  static async getAllBooks(): Promise<Book[]> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_BOOKS, 'readonly')
        const store = transaction.objectStore(STORE_BOOKS)
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to get books from IndexedDB:', error)
      return []
    }
  }

  /**
   * 保存书籍元数据
   */
  static async saveBook(book: Book): Promise<void> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_BOOKS, 'readwrite')
        const store = transaction.objectStore(STORE_BOOKS)
        const request = store.put(book)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to save book:', error)
    }
  }

  /**
   * 删除书籍及其内容
   */
  static async deleteBook(bookId: string): Promise<void> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_BOOKS, STORE_CONTENTS, STORE_RAW_FILES], 'readwrite')
        transaction.objectStore(STORE_BOOKS).delete(bookId)
        transaction.objectStore(STORE_CONTENTS).delete(bookId)
        transaction.objectStore(STORE_RAW_FILES).delete(bookId)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } catch (error) {
      console.error('Failed to delete book:', error)
    }
  }

  /**
   * 保存原始文件
   */
  static async saveRawFile(bookId: string, file: Blob): Promise<void> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_RAW_FILES, 'readwrite')
        const store = transaction.objectStore(STORE_RAW_FILES)
        const request = store.put({ bookId, file })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to save raw file:', error)
    }
  }

  /**
   * 获取原始文件
   */
  static async getRawFile(bookId: string): Promise<Blob | null> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_RAW_FILES, 'readonly')
        const store = transaction.objectStore(STORE_RAW_FILES)
        const request = store.get(bookId)
        request.onsuccess = () => resolve(request.result ? request.result.file : null)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to get raw file:', error)
      return null
    }
  }

  /**
   * 保存书籍章节内容
   */
  static async saveBookContent(bookId: string, content: Chapter[]): Promise<void> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_CONTENTS, 'readwrite')
        const store = transaction.objectStore(STORE_CONTENTS)
        const request = store.put({ bookId, content })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to save book content:', error)
    }
  }

  /**
   * 获取书籍内容
   */
  static async getBookContent(bookId: string): Promise<Chapter[]> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_CONTENTS, 'readonly')
        const store = transaction.objectStore(STORE_CONTENTS)
        const request = store.get(bookId)
        request.onsuccess = () => resolve(request.result ? request.result.content : [])
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Failed to get book content:', error)
      return []
    }
  }

  /**
   * 更新书籍进度
   */
static async updateBookProgress(bookId: string, chapter: number, position: number, cfi?: string): Promise<void> {
  console.log('updateBookProgress called', { bookId, chapter, position, cfi })
  const books = await this.getAllBooks()
  const book = books.find(b => b.id === bookId)
  if (book) {
    book.progress = { chapter, position, timestamp: Date.now(), cfi }
    await this.saveBook(book)
    console.log('Progress updated in DB', book.progress)
  } else {
    console.error('Book not found', bookId)
  }
}

  /**
   * 清除所有书籍数据
   */
  static async clearAll(): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_BOOKS, STORE_CONTENTS, STORE_RAW_FILES], 'readwrite')
      transaction.objectStore(STORE_BOOKS).clear()
      transaction.objectStore(STORE_CONTENTS).clear()
      transaction.objectStore(STORE_RAW_FILES).clear()
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
}
