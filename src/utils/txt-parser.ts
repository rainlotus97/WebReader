import type { Chapter } from '@/types'

/**
 * TXT 文件解析器
 */
export class TxtParser {
  /**
   * 解析 TXT 文件
   */
  static async parse(file: File): Promise<Chapter[]> {
    try {
      const text = await file.text()
      return this.splitIntoChapters(text)
    } catch (error) {
      console.error('Failed to parse TXT:', error)
      throw error
    }
  }

  /**
   * 将文本分割成章节
   * 识别常见的章节标记：第n章、Chapter n、第n回等
   */
  private static splitIntoChapters(text: string): Chapter[] {
    // 更加严谨的章节识别正则
    const chapterPatterns = [
      /^[\s]*第[0-9一二三四五六七八九十百千万]+[章节回卷部集课期][\s\t]*[^\n]*/gm, // 第1章, 第一回, 第一卷 etc.
      /^[\s]*(?:Chapter|Section|Part)\s*[0-9]+[\s\t]*[^\n]*/gmi, // Chapter 1, Section 1 etc.
      /^[\s]*【[\s]*第?[0-9一二三四五六七八九十百千万]+[章节回卷部集课期][\s\t]*[^\n]*】/gm, // 【第一章】 形式
      /^[\s]*[0-9]{1,4}[\s\t]+[^\n]{1,50}$/gm, // 1. 标题 形式
    ]

    let matches: any[] = []
    
    // 优先尝试最匹配的模式
    let maxCount = 0
    for (const pattern of chapterPatterns) {
      const currentMatches = Array.from(text.matchAll(pattern))
      if (currentMatches.length > maxCount) {
        maxCount = currentMatches.length
        matches = currentMatches
      }
    }

    // 过滤掉可能是正文的误匹配（标题行通常不应该太长）
    matches = matches.filter(m => m[0].trim().length < 100)

    if (matches.length < 2) {
      return this.splitByLength(text)
    }

    const chapters: Chapter[] = []
    
    // 处理第一个章节之前的序言部分
    const firstMatchIndex = matches[0].index || 0
    if (firstMatchIndex > 10) {
      const prologue = text.substring(0, firstMatchIndex).trim()
      if (prologue.length > 0) {
        chapters.push({
          id: 'prologue',
          title: '序言',
          content: prologue,
          index: 0
        })
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const startMatch = matches[i]
      const endMatch = matches[i + 1]

      const startIndex = startMatch.index || 0
      const endIndex = endMatch ? endMatch.index : text.length

      const fullChapterText = text.substring(startIndex, endIndex).trim()
      
      // 提取标题（第一行）
      const lines = fullChapterText.split('\n')
      const title = lines[0].trim()
      
      // 提取内容（剩余行）
      const content = lines.slice(1).join('\n').trim()

      if (content.length > 0 || i === matches.length - 1) {
        chapters.push({
          id: `chapter-${chapters.length}`,
          title: title || `第 ${chapters.length + 1} 章`,
          content: content || '（本章无内容）',
          index: chapters.length
        })
      }
    }

    return chapters.length > 0 ? chapters : this.splitByLength(text)
  }

  /**
   * 按固定字符数分割成章节
   */
  private static splitByLength(text: string, charsPerChapter: number = 5000): Chapter[] {
    const chapters: Chapter[] = []
    let index = 0

    for (let i = 0; i < text.length; i += charsPerChapter) {
      const content = text.substring(i, Math.min(i + charsPerChapter, text.length)).trim()
      if (content.length > 0) {
        chapters.push({
          id: `chapter-${index}`,
          title: `第 ${index + 1} 章`,
          content,
          index
        })
        index++
      }
    }

    return chapters
  }
}
