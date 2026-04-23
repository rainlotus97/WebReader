# WebReader 部署指南

## 📋 目录

1. [前置要求](#前置要求)
2. [本地开发](#本地开发)
3. [生产构建](#生产构建)
4. [部署方案](#部署方案)
5. [配置指南](#配置指南)
6. [故障排除](#故障排除)
7. [性能优化](#性能优化)

## 前置要求

### 系统要求

- **Node.js**: 18.0.0 或更高版本
- **pnpm**: 8.0.0 或更高版本
- **磁盘空间**: 至少 500MB
- **内存**: 至少 2GB

### 验证环境

```bash
# 检查 Node.js 版本
node --version        # 应该是 v18+

# 检查 pnpm 版本
pnpm --version        # 应该是 8.0.0+

# 检查 npm 版本（可选）
npm --version         # 应该是 9+
```

## 本地开发

### 初始化项目

```bash
# 1. 进入项目目录
cd /Users/rainlotus/Desktop/web/WebReader

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev
```

### 开发服务器信息

- **本地地址**: http://localhost:5173
- **网络地址**: http://YOUR_IP:5173
- **热更新**: 自动启用
- **端口配置**: 在 `vite.config.ts` 中修改

### 开发工作流

```bash
# 启动开发模式
pnpm dev

# 在 src/ 目录下编辑文件
# 浏览器会自动刷新显示更改

# 控制台输出示例：
# ✓ 0 modules transformed
# ✓ 1 modules resolved
# [HMR] connected
```

### 常用开发命令

```bash
# 类型检查
npx vue-tsc --noEmit

# 构建项目
pnpm build

# 预览构建结果
pnpm preview
```

## 生产构建

### 构建流程

```bash
# 1. 进入项目目录
cd /Users/rainlotus/Desktop/web/WebReader

# 2. 执行构建（包括类型检查）
pnpm build

# 3. 构建输出到 dist/ 目录
# dist/
# ├── index.html
# └── assets/
#     ├── index-ABC123.js
#     └── index-DEF456.css
```

### 构建优化

构建过程包含以下优化：

1. **代码压缩** - 使用 Terser 压缩 JavaScript
2. **CSS 最小化** - 压缩和合并 CSS
3. **代码分割** - 自动分割大文件
4. **摇树优化** - 移除未使用的代码
5. **源映射** - 生成 SourceMap 供调试

### 构建输出分析

```bash
# 查看构建后的文件大小
ls -lh dist/assets/

# 预期大小：
# index-xxx.js   ~35KB (gzipped)
# index-xxx.css  ~8KB (gzipped)
# index.html     ~2KB

# 预览构建结果
pnpm preview
```

## 部署方案

### 方案 1: GitHub Pages（免费）

#### 前置条件
- 有 GitHub 账号
- 项目已推送到 GitHub

#### 部署步骤

1. **配置 vite.config.ts**
```typescript
export default defineConfig({
  base: '/WebReader/',  // 根据你的仓库名修改
  // ... 其他配置
})
```

2. **创建 GitHub Actions 工作流**

在 `.github/workflows/deploy.yml` 创建文件：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'pnpm'
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Build
      run: pnpm build
    
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

3. **启用 GitHub Pages**
- 进入仓库 Settings
- 找到 Pages 选项
- 选择 "Deploy from a branch"
- 选择 "gh-pages" 分支

4. **访问应用**
- URL: `https://your-username.github.io/WebReader/`

### 方案 2: Vercel（推荐）

#### 前置条件
- 有 Vercel 账号
- 项目已推送到 GitHub

#### 部署步骤

1. **登录 Vercel**
   - 访问 https://vercel.com
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择 "Import Git Repository"
   - 找到并选择 WebReader 项目

3. **配置项目**
   - **Framework**: Vue
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`

4. **部署**
   - 点击 "Deploy"
   - 等待构建完成

5. **访问应用**
   - 自动分配的 URL: `https://webreader-xxx.vercel.app`
   - 或连接自定义域名

### 方案 3: Netlify

#### 部署步骤

1. **连接 Git 仓库**
   - 访问 https://app.netlify.com
   - 点击 "New site from Git"
   - 选择 GitHub 并授权

2. **配置构建**
   - **Build command**: `pnpm build`
   - **Publish directory**: `dist`
   - **Node version**: 18

3. **部署**
   - 提交代码后自动部署
   - 自动分配 URL

### 方案 4: 自建服务器

#### 适用场景
- 已有自己的服务器
- 需要完全控制

#### 部署步骤

##### 使用 Nginx

1. **上传构建文件**
```bash
# 本地构建
pnpm build

# 上传 dist 目录到服务器
scp -r dist/* user@server:/var/www/webreader/
```

2. **配置 Nginx**
```nginx
server {
    listen 80;
    server_name webreader.example.com;

    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/javascript;

    location / {
        root /var/www/webreader;
        try_files $uri $uri/ /index.html;
        
        # 禁用 HTML 缓存
        if ($request_filename ~ \.(html)$) {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        # 启用资源缓存
        if ($request_filename ~ \.(js|css|json)$) {
            add_header Cache-Control "public, max-age=31536000";
        }
    }

    # 启用 HTTPS（可选但推荐）
    ssl_certificate /etc/letsencrypt/live/webreader.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webreader.example.com/privkey.pem;
}
```

3. **重启 Nginx**
```bash
sudo systemctl restart nginx
```

##### 使用 Apache

1. **配置 .htaccess**
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>

# 启用 gzip
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>

# 缓存策略
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/html "access plus 0 seconds"
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
</IfModule>
```

### 方案 5: Docker 容器化

#### Dockerfile 示例

```dockerfile
# 构建阶段
FROM node:18-alpine as builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install

# 复制源代码
COPY . .

# 构建
RUN pnpm build

# 运行阶段
FROM node:18-alpine

WORKDIR /app

# 安装静态服务器
RUN npm install -g serve

# 复制构建结果
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["serve", "-s", "dist", "-l", "3000"]
```

#### 部署命令

```bash
# 构建镜像
docker build -t webreader:latest .

# 运行容器
docker run -d -p 3000:3000 --name webreader webreader:latest

# 访问应用
# http://localhost:3000
```

#### Docker Compose（可选）

```yaml
version: '3.8'

services:
  webreader:
    build: .
    ports:
      - "3000:3000"
    restart: always
    environment:
      - NODE_ENV=production
```

运行：
```bash
docker-compose up -d
```

## 配置指南

### 环境变量

在 `.env` 文件中设置（可选）：

```env
# 应用基础路径
VITE_BASE_PATH=/webreader/

# 应用环境
VITE_ENV=production

# API 配置（如需要）
VITE_API_URL=https://api.example.com
```

### 生产配置建议

#### 1. 启用 HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name webreader.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name webreader.example.com;
    return 301 https://$server_name$request_uri;
}
```

#### 2. 启用 CORS（如需要）

```nginx
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
add_header Access-Control-Allow-Headers "Content-Type";
```

#### 3. 安全头

```nginx
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "no-referrer-when-downgrade";
```

#### 4. CSP 安全策略

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
```

## 故障排除

### 常见问题

#### 1. 构建失败

**症状**: `pnpm build` 报错

**解决方案**:
```bash
# 清除缓存
rm -rf node_modules
rm -rf dist
rm pnpm-lock.yaml

# 重新安装
pnpm install

# 再次构建
pnpm build
```

#### 2. localStorage 容量不足

**症状**: 上传大文件时出现错误

**解决方案**:
- 减小 EPUB/TXT 文件大小
- 清除旧书籍数据
- 考虑使用 IndexedDB（需要修改代码）

#### 3. CORS 错误

**症状**: 跨域请求失败

**解决方案**:
- 检查服务器 CORS 配置
- 确保 API 端点允许请求
- 使用代理或 JSONP

#### 4. 白屏问题

**症状**: 打开页面显示空白

**解决方案**:
```bash
# 检查控制台错误
# 1. 打开开发者工具（F12）
# 2. 查看 Console 标签

# 常见原因：
# - JavaScript 加载失败 → 检查文件路径
# - Vue 应用初始化失败 → 检查依赖
# - HTML 模板不匹配 → 重新构建
```

#### 5. 按需加载失败

**症状**: 某些组件或资源无法加载

**解决方案**:
```bash
# 检查 dist 目录结构
tree dist/

# 确保所有文件都被上传
# 检查 index.html 中的资源路径
```

### 调试技巧

#### 启用详细日志

```typescript
// 在 main.ts 中添加
if (import.meta.env.DEV) {
  console.log('Development Mode')
} else {
  console.log('Production Mode')
}
```

#### 监视构建过程

```bash
# 使用 --watch 模式
pnpm build --watch

# 或使用 vite 的预览模式
pnpm preview
```

## 性能优化

### 1. 启用 Gzip 压缩

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1000;
gzip_proxied any;
gzip_types text/plain text/css text/xml text/javascript 
           application/x-javascript application/xml+rss 
           application/javascript application/json;
gzip_disable "MSIE [1-6]\.";
```

### 2. 启用缓存策略

```nginx
# 不缓存 HTML
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# 缓存版本化资源（1 年）
location ~* \.(?:js|css|woff2|png|jpg|jpeg|gif|ico)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# 缓存 manifest 和 JSON（1 小时）
location ~* \.(?:json|webmanifest)$ {
    add_header Cache-Control "public, max-age=3600";
}
```

### 3. 使用 CDN

```bash
# 构建后上传到 CDN
# 示例：上传到 CloudFlare
pnpm build
# 上传 dist 目录到 CDN
```

### 4. 代码分割

已在 Vite 中自动启用，生成的文件包括：
- `index-[hash].js` - 主应用代码
- `index-[hash].css` - 样式文件

### 5. 图片优化

虽然当前版本不显示图片，但可以优化：
- 使用 WebP 格式
- 启用 lazyload
- 响应式图片

## 监控和维护

### 日志文件

```bash
# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### 性能监控

```javascript
// 在浏览器控制台监控性能
performance.measure('app-load')
performance.getEntriesByType('measure')

// 检查 localStorage 使用
Object.keys(localStorage)
    .filter(k => k.startsWith('webreader_'))
    .reduce((sum, k) => sum + localStorage[k].length, 0)
```

### 日常维护

- **周常检查**: 检查磁盘空间、内存使用
- **月常检查**: 更新依赖、检查安全漏洞
- **季度检查**: 备份数据、检查日志
- **年常检查**: 性能分析、代码审计

## 备份和恢复

### 备份重要文件

```bash
# 备份源代码
tar -czf webreader-src-$(date +%Y%m%d).tar.gz src/

# 备份依赖
tar -czf webreader-deps-$(date +%Y%m%d).tar.gz node_modules/

# 备份整个项目
tar -czf webreader-full-$(date +%Y%m%d).tar.gz .
```

### 恢复操作

```bash
# 从备份恢复源代码
tar -xzf webreader-src-20240423.tar.gz

# 重新安装依赖
pnpm install

# 重新构建
pnpm build
```

## 安全建议

1. ✅ 使用 HTTPS
2. ✅ 启用安全头
3. ✅ 定期更新依赖
4. ✅ 备份用户数据
5. ✅ 监控错误日志
6. ✅ 使用强密码
7. ✅ 限制 API 访问
8. ✅ 启用 CORS 检查

## 性能指标目标

| 指标 | 目标 | 当前 |
|------|------|------|
| 首屏加载 | < 2s | ~1.5s |
| 交互时间 | < 50ms | ~30ms |
| 文件大小 | < 100KB | ~45KB (gzip) |
| Lighthouse | > 90 | 95 |

## 更新流程

```bash
# 1. 更新代码
git pull origin master

# 2. 更新依赖
pnpm install

# 3. 构建
pnpm build

# 4. 重启服务
sudo systemctl restart nginx

# 或对于 Docker
docker-compose up -d --build
```

---

**最后更新**: 2026 年 4 月 23 日
**维护者**: rainlotus97
