# WebReader 开发指南

## 项目概述

WebReader 是一个功能完整的网页阅读器，支持 EPUB 和 TXT 格式的电子书。采用现代前端技术栈（Vite + Vue3 + TypeScript）构建，提供良好的用户体验和代码可维护性。

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────┐
│              App.vue (路由容器)                  │
└────────────────┬──────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                  │
    ┌───▼────┐        ┌───▼────┐
    │Bookshelf│       │Reader   │
    │  Page   │       │  Page   │
    └────┬────┘       └────┬────┘
         │                  │
         ├──────────────────┴──────────────────┐
         │                                      │
    ┌────▼─────────────────┐        ┌──────────▼────┐
    │   StorageManager      │        │  EventBus     │
    │ (localStorage 操作)    │        │ (事件通信)    │
    └──────────────────────┘        └───────────────┘
         │                                    │
    ┌────▼──────────────┐            ┌────────▼────────┐
    │ EpubParser        │            │ TxtParser        │
    │ (EPUB 解析)       │            │ (TXT 解析)       │
    └───────────────────┘            └──────────────────┘
```

### 文件结构详解

```
src/
├── types/
│   └── index.ts              # 全局类型定义
│       ├── Book              # 书籍对象类型
│       ├── Chapter           # 章节对象类型
│       └── ReaderState       # 阅读器状态类型
│
├── utils/
│   ├── storage.ts            # 本地存储管理
│   │   └── StorageManager (class)
│   │       ├── getAllBooks()
│   │       ├── saveBook()
│   │       ├── deleteBook()
│   │       ├── saveBookContent()
│   │       ├── getBookContent()
│   │       └── updateBookProgress()
│   │
│   ├── epub-parser.ts        # EPUB 文件解析
│   │   └── EpubParser (class)
│   │       └── parse(file)
│   │
│   ├── txt-parser.ts         # TXT 文件解析
│   │   └── TxtParser (class)
│   │       └── parse(file)
│   │
│   ├── event-bus.ts          # 简易事件总线
│   │   └── eventBus (singleton)
│   │       ├── on()
│   │       ├── off()
│   │       └── emit()
│   │
│   └── helpers.ts            # 工具函数
│       ├── generateId()
│       ├── generateFileHash()
│       ├── formatFileSize()
│       ├── throttle()
│       └── debounce()
│
├── pages/
│   ├── Bookshelf.vue         # 书架页面
│   │   ├── 书籍上传
│   │   ├── 书籍列表展示
│   │   └── 书籍删除
│   │
│   └── Reader.vue            # 阅读器页面
│       ├── PC 版本布局
│       ├── 移动版本布局
│       ├── 目录导航
│       ├── 快捷键支持
│       └── 进度保存
│
├── styles/
│   └── main.css              # 全局样式
│
├── App.vue                   # 根组件（页面容器）
├── env.d.ts                  # TypeScript 类型声明
└── main.ts                   # Vue 应用入口
```

## 核心模块说明

### 1. StorageManager (存储管理)

负责所有与浏览器本地存储的交互。

**主要功能：**
- 书籍列表管理（增删改查）
- 书籍内容存储与读取
- 阅读进度保存

**实现细节：**
- 书籍列表存储在 `webreader_books` key
- 单本书籍内容存储在 `webreader_${bookId}` key
- 进度信息嵌入在书籍对象中

**示例：**
```typescript
// 加载所有书籍
const books = StorageManager.getAllBooks()

// 保存书籍
StorageManager.saveBook(book)

// 更新进度
StorageManager.updateBookProgress(bookId, chapterIndex, position)

// 删除书籍
StorageManager.deleteBook(bookId)
```

### 2. EpubParser (EPUB 解析)

使用 JSZip 库解析 EPUB 文件格式。

**解析流程：**
1. 读取 `META-INF/container.xml` 获取 OPF 文件路径
2. 读取 OPF 文件获取目录和阅读顺序（spine）
3. 按照 spine 顺序读取所有内容文件
4. 从 HTML 中提取纯文本

**处理的 HTML 标签：**
- 移除脚本、样式、注释
- 转换 HTML 实体
- 清理多余空白

**返回格式：**
```typescript
Chapter[] = [
  {
    id: "chapter-0",
    title: "第 1 章",
    content: "清理后的纯文本内容",
    index: 0
  },
  // ...
]
```

### 3. TxtParser (TXT 解析)

智能识别 TXT 文件中的章节。

**识别模式：**
- `第[数字]章` / `第[中文数字]章`
- `Chapter n` / `chapter n`
- `[数字].` 格式

**分割策略：**
1. 尝试使用正则表达式识别章节标记
2. 如果找不到标记，按固定字符数（5000字）分割
3. 确保返回至少一个章节

### 4. EventBus (事件总线)

简易的发布-订阅模式实现，用于组件间通信。

**使用场景：**
- 书架页面通知阅读器打开书籍
- 阅读器通知书架返回

**API：**
```typescript
// 订阅事件
eventBus.on('open-book', (book) => {
  // 处理事件
})

// 发送事件
eventBus.emit('open-book', book)

// 取消订阅
eventBus.off('open-book', callback)
```

### 5. 页面导航

使用 HTML5 CustomEvent 进行页面切换。

**导航流程：**
```
Bookshelf.vue
    ↓
点击书籍卡片
    ↓
eventBus.emit('open-book', book)
    ↓
window.dispatchEvent('navigate', {page: 'reader'})
    ↓
App.vue 监听事件
    ↓
切换到 Reader.vue
```

## 功能实现细节

### 响应式设计

**断点设置：**
- `>= 768px`: PC 版本（侧边栏目录 + 主阅读区）
- `< 768px`: 移动版本（隐藏式控制栏 + 目录抽屉）

**关键 CSS：**
```css
@media (min-width: 768px) {
  /* PC 样式 */
}

@media (max-width: 767px) {
  /* 移动样式 */
}
```

### 快捷键支持

**PC 快捷键映射：**
| 快捷键 | 功能 |
|--------|------|
| → / Space | 下一章 |
| ← / Backspace | 上一章 |

**实现：**
```typescript
function handleKeyPress(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      nextChapter()
    } else if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
      prevChapter()
    }
  }
}
```

### 进度保存

**自动保存时机：**
- 翻页时
- 跳转章节时
- 返回书架时

**保存的数据：**
```typescript
{
  chapter: 5,        // 当前章节索引
  position: 0,       // 章节内位置（预留字段）
  timestamp: 1234567 // 保存时间戳
}
```

### 文件上传处理

**处理流程：**
1. 用户选择文件
2. 根据文件扩展名判断类型（.epub / .txt）
3. 调用相应解析器
4. 生成唯一 ID
5. 保存书籍元数据和内容
6. 刷新书籍列表

**上传进度显示：**
- 显示整体进度百分比
- 处理完成后自动隐藏

## 扩展指南

### 添加新的文件格式支持

1. 创建新的解析器（例如 `mobi-parser.ts`）：

```typescript
export class MobiParser {
  static async parse(file: File): Promise<Chapter[]> {
    // 实现解析逻辑
    return chapters
  }
}
```

2. 在 `Bookshelf.vue` 中导入并使用：

```typescript
import { MobiParser } from '@/utils/mobi-parser'

// 在 processFile 中添加
if (fileType === 'mobi') {
  chapters = await MobiParser.parse(file)
}
```

3. 在 `processFile` 中处理新格式：

```typescript
const fileType = file.name.endsWith('.mobi') ? 'mobi' : 
                 file.name.endsWith('.epub') ? 'epub' : 'txt'
```

### 自定义样式

**修改配色方案：**
在 `src/styles/main.css` 顶部定义 CSS 变量：

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --text-color: #333;
  --bg-color: #f5f5f5;
}
```

### 添加新功能模块

**命名规范：**
- 工具函数：`src/utils/[功能名].ts`
- 页面组件：`src/pages/[页面名].vue`
- 类型定义：在 `src/types/index.ts` 中添加

## 性能优化

### 已实现的优化

1. **代码分割**
   - Vite 自动进行 code splitting
   - 按需加载组件

2. **样式优化**
   - 使用 scoped CSS 避免样式污染
   - 最小化 CSS 体积

3. **事件处理**
   - 使用 throttle/debounce 避免频繁调用
   - 及时清理事件监听器

### 可进一步优化的方向

1. **虚拟滚动**
   - 对于长章节，使用虚拟滚动提高性能

2. **缓存策略**
   - 实现 Service Worker 缓存
   - 离线阅读支持

3. **图片优化**
   - 对 EPUB 中的图片进行压缩
   - 使用更高效的图片格式

## 常见问题

### Q: 为什么 EPUB 中的图片和样式没有显示？

A: 当前解析器只提取纯文本内容，以简化解析逻辑。如需支持图片和样式，需要：
1. 修改 HTML 提取逻辑
2. 实现图片的 Base64 编码或 Blob 存储
3. 应用样式时使用 iframe 或 shadow DOM

### Q: 本地存储的容量限制是多少？

A: 通常为 5-10MB，取决于浏览器。大文件可能无法完全存储。

### Q: 如何清除所有书籍数据？

A: 在浏览器开发者工具中：
1. 打开 DevTools（F12）
2. 进入 Application → Local Storage
3. 找到域名对应的条目
4. 删除 `webreader_` 开头的所有项

### Q: 快捷键在移动设备上不工作？

A: 正常行为。快捷键仅在 PC 版本启用（宽度 >= 768px）。

## 浏览器兼容性

| 浏览器 | 版本 | 支持状态 |
|--------|------|----------|
| Chrome | 90+ | ✅ 完全支持 |
| Firefox | 88+ | ✅ 完全支持 |
| Safari | 14+ | ✅ 完全支持 |
| Edge | 90+ | ✅ 完全支持 |
| IE 11 | - | ❌ 不支持 |

## 调试技巧

### 1. 查看本地存储

```javascript
// 在浏览器控制台执行
localStorage.getItem('webreader_books')
```

### 2. 清除特定书籍

```javascript
localStorage.removeItem('webreader_${bookId}')
```

### 3. 查看事件总线

```javascript
// 打印所有监听的事件
console.log(eventBus.listeners)
```

## 构建部署

### 生产构建

```bash
pnpm build
```

生成的文件在 `dist/` 目录。

### 部署到静态服务器

可以部署到任何支持静态文件的服务器：
- GitHub Pages
- Vercel
- Netlify
- 自建 Web 服务器

### 关键注意事项

1. 需要支持 history 路由（当前使用事件路由，无此限制）
2. 支持 HTTPS（推荐，某些浏览器 API 需要）
3. 跨域资源共享（CORS）配置

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。
