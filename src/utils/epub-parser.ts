import JSZip from 'jszip'
import type { Chapter } from '@/types'

/**
 * EPUB 文件解析器
 */
export class EpubParser {
  /**
   * 解析 EPUB 文件
   */
  static async parse(file: File): Promise<{ chapters: Chapter[], metadata: { title: string, cover?: string } }> {
    try {
      const zip = new JSZip()
      const zipContent = await zip.loadAsync(file)

      // 读取 container.xml 获取 OPF 文件路径
      const containerXml = await zipContent.file('META-INF/container.xml')?.async('string')
      if (!containerXml) {
        throw new Error('Invalid EPUB: container.xml not found')
      }

      const opfPath = this.extractOpfPath(containerXml)
      if (!opfPath) {
        throw new Error('Invalid EPUB: OPF path not found')
      }

      // 读取 OPF 文件获取目录和内容文件顺序
      const opfContent = await zipContent.file(opfPath)?.async('string')
      if (!opfContent) {
        throw new Error('Invalid EPUB: OPF file not found')
      }

      const spine = this.extractSpine(opfContent)
      const manifest = this.extractManifest(opfContent)
      
      // 提取封面（返回 Base64 字符串）
      const cover = await this.extractCover(zipContent, opfContent, opfPath, manifest)

      // 提取目录 (NCX 或 Nav)
      const toc = await this.extractToc(zipContent, opfContent, opfPath)

      // 提取标题
      const title = this.extractTitle(opfContent) || file.name.replace(/\.epub$/i, '')

      // 读取所有内容文件
      const chapters: Chapter[] = []
      const baseDir = opfPath.substring(0, opfPath.lastIndexOf('/'))

      for (let i = 0; i < spine.length; i++) {
        const itemId = spine[i]
        const manifestItem = manifest.find(m => m.id === itemId)

        if (manifestItem && manifestItem.href) {
          const filePath = baseDir ? `${baseDir}/${manifestItem.href}` : manifestItem.href
          const file = zipContent.file(filePath)
          
          if (file) {
            const content = await file.async('string')
            // 解析内容，尝试保留基础格式
            const bodyContent = this.extractBodyContent(content)
            
            // 尝试从目录中找标题
            const tocItem = toc.find(t => t.href.includes(manifestItem.href))
            const title = tocItem ? tocItem.title : `第 ${chapters.length + 1} 章`

            chapters.push({
              id: `chapter-${i}`,
              title,
              content: bodyContent,
              index: i
            })
          }
        }
      }

      return { chapters, metadata: { title, cover } }
    } catch (error) {
      console.error('Failed to parse EPUB:', error)
      throw error
    }
  }

  /**
   * Blob 转 Base64
   */
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * 提取标题
   */
  private static extractTitle(opfContent: string): string | null {
    const titleMatch = opfContent.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)
    return titleMatch ? titleMatch[1].trim() : null
  }

  /**
   * 提取封面（返回 Base64 字符串）
   */
  private static async extractCover(zip: JSZip, opfContent: string, opfPath: string, manifest: any[]): Promise<string | undefined> {
    const baseDir = opfPath.substring(0, opfPath.lastIndexOf('/'))
    let coverId: string | null = null

    // 1. 从 meta 标签中寻找封面 ID
    const coverMetaMatch = opfContent.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/)
    if (coverMetaMatch) {
      coverId = coverMetaMatch[1]
    }

    // 2. 寻找 properties="cover-image" 的 item
    if (!coverId) {
      const coverItemMatch = opfContent.match(/<item[^>]*properties="cover-image"[^>]*id="([^"]+)"/)
      if (coverItemMatch) {
        coverId = coverItemMatch[1]
      }
    }

    // 3. 寻找包含 "cover" 字样的 item
    if (!coverId) {
      const genericCoverMatch = opfContent.match(/<item[^>]*id="([^"]*cover[^"]*)"/)
      if (genericCoverMatch) {
        coverId = genericCoverMatch[1]
      }
    }

    if (coverId) {
      const coverItem = manifest.find(m => m.id === coverId)
      if (coverItem) {
        const coverPath = baseDir ? `${baseDir}/${coverItem.href}` : coverItem.href
        const coverFile = zip.file(coverPath)
        if (coverFile) {
          const blob = await coverFile.async('blob')
          // 转为 Base64 字符串并返回
          return await this.blobToBase64(blob)
        }
      }
    }

    return undefined
  }

  /**
   * 提取目录
   */
  private static async extractToc(zip: JSZip, opfContent: string, opfPath: string): Promise<Array<{ title: string; href: string }>> {
    const baseDir = opfPath.substring(0, opfPath.lastIndexOf('/'))
    
    // 1. 尝试寻找 nav 文件 (EPUB 3)
    const navItemMatch = opfContent.match(/<item[^>]*properties="nav"[^>]*href="([^"]+)"/)
    if (navItemMatch) {
      const navPath = baseDir ? `${baseDir}/${navItemMatch[1]}` : navItemMatch[1]
      const navContent = await zip.file(navPath)?.async('string')
      if (navContent) {
        return this.parseNavToc(navContent)
      }
    }

    // 2. 尝试寻找 ncx 文件 (EPUB 2)
    const ncxItemMatch = opfContent.match(/<item[^>]*media-type="application\/x-dtbncx\+xml"[^>]*href="([^"]+)"/)
    if (ncxItemMatch) {
      const ncxPath = baseDir ? `${baseDir}/${ncxItemMatch[1]}` : ncxItemMatch[1]
      const ncxContent = await zip.file(ncxPath)?.async('string')
      if (ncxContent) {
        return this.parseNcxToc(ncxContent)
      }
    }

    return []
  }

  private static parseNavToc(content: string): Array<{ title: string; href: string }> {
    const toc: Array<{ title: string; href: string }> = []
    const matches = content.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)
    for (const match of matches) {
      toc.push({
        href: match[1].split('#')[0],
        title: match[2].replace(/<[^>]+>/g, '').trim()
      })
    }
    return toc
  }

  private static parseNcxToc(content: string): Array<{ title: string; href: string }> {
    const toc: Array<{ title: string; href: string }> = []
    const navPoints = content.matchAll(/<navPoint[^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content[^>]*src="([^"]+)"/g)
    for (const match of navPoints) {
      toc.push({
        title: match[1].trim(),
        href: match[2].split('#')[0]
      })
    }
    return toc
  }

  /**
   * 从 HTML 中提取 body 内容，保留基础标签
   */
  private static extractBodyContent(html: string): string {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    let content = bodyMatch ? bodyMatch[1] : html

    // 移除脚本和样式
    content = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      
    // 简化标签，但保留结构
    return content.trim()
  }

  /**
   * 从 container.xml 提取 OPF 路径
   */
  private static extractOpfPath(containerXml: string): string | null {
    const match = containerXml.match(/rootfile\s+full-path="([^"]+)"/)
    return match ? match[1] : null
  }

  /**
   * 从 OPF 提取 spine (阅读顺序)
   */
  private static extractSpine(opfContent: string): string[] {
    const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/)
    if (!spineMatch) return []

    const itemrefs = spineMatch[1].match(/<itemref[^>]*idref="([^"]+)"/g) || []
    return itemrefs.map(ref => {
      const match = ref.match(/idref="([^"]+)"/)
      return match ? match[1] : ''
    })
  }

  /**
   * 从 OPF 提取 manifest (文件列表)
   */
  private static extractManifest(opfContent: string): Array<{ id: string; href: string }> {
    const manifestMatch = opfContent.match(/<manifest[^>]*>([\s\S]*?)<\/manifest>/)
    if (!manifestMatch) return []

    const items = manifestMatch[1].match(/<item[^>]*\/>/g) || []
    return items
      .map(item => {
        const idMatch = item.match(/id="([^"]+)"/)
        const hrefMatch = item.match(/href="([^"]+)"/)
        return {
          id: idMatch ? idMatch[1] : '',
          href: hrefMatch ? hrefMatch[1] : ''
        }
      })
      .filter(item => item.id && item.href)
  }
}