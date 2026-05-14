# Debug Log — 赤子の相册

汇总开发过程中发现并修复的全部问题。

---

## 1. 上传图片内容为空（关键）

**现象**：上传图片后 MinIO 存储 0 字节，图片无法显示。

**根因**：`backend/internal/service/image_service.go:60` 原本使用 `io.TeeReader(file, &buf)` 同时读取和捕获，但 `TeeReader` 仅在读取 `buf` 时才会从 `file` 读取数据，后续 `Upload` 传入 `&buf` 时 `buf` 已为空，导致上传 0 字节。

**修复**：[image_service.go:57](backend/internal/service/image_service.go#L57) 改用 `io.ReadAll(file)` 将文件完整读入 `fileBytes []byte`，后续所有操作（MIME 检测、缩略图生成、上传）统一从 `fileBytes` 读取。

---

## 2. 多用户标记同一标签冲突

**现象**：用户 A 标记图片标签后，用户 B 无法对同一图片添加相同标签，报错 duplicate key。

**根因**：`image_tags` 表主键为 `(image_id, tag_id)`，只允许一行记录。多用户对同一图片同一标签标记时冲突。

**修复**：ALTER TABLE 将主键改为 `(image_id, tag_id, user_id)`：
```sql
ALTER TABLE image_tags DROP CONSTRAINT image_tags_pkey;
UPDATE image_tags SET user_id = ... WHERE user_id IS NULL;
ALTER TABLE image_tags ADD PRIMARY KEY (image_id, tag_id, user_id);
```
对应迁移代码见 [main.go:202-208](backend/cmd/server/main.go#L202-L208)。

---

## 3. 下载 URL 返回内部 MinIO 地址

**现象**：前端获取的图片 URL 为 `http://minio:9000/images/...`，浏览器无法访问。

**根因**：MinIO SDK 生成的预签名 URL 使用 MinIO 内部 hostname。之前用预签名 URL 作为对外 URL。

**修复**：[image_service.go:304-316](backend/internal/service/image_service.go#L304-L316)
`fillURLs()` 函数统一使用 `CDN_BASE_URL` 拼接原始 URL，绕过预签名 URL 的内部地址问题。
```go
img.URL = base + "/" + img.StorageKey
img.DownURL = base + "/" + img.StorageKey
img.ThumbURL = base + "/" + *img.ThumbnailKey
```

---

## 4. Nginx 图片代理返回 XML 而非图片

**现象**：访问 `/images/xxx.jpg` 返回 MinIO ListBucket XML。

**根因**：`nginx.conf` 中 `proxy_pass http://$minio;` 使用变量导致 URI 被重置为 `/`，Nginx 请求到 MinIO 根路径，返回 bucket 列表 XML。

**修复**：[nginx.conf:33](nginx/nginx.conf#L33) 去掉变量，直接使用固定 hostname：
```nginx
proxy_pass http://minio:9000/images/;
```

---

## 5. Nginx 启动时报 "host not found in upstream 'api'"

**现象**：Nginx 容器先于 API 容器启动时，`proxy_pass http://api:8080;` 中 `api` 主机名无法解析，Nginx 崩溃。

**根因**：Docker DNS 在 API 容器启动后才注册 `api` 主机名，Nginx 启动时解析失败。

**修复**：[nginx.conf:25](nginx/nginx.conf#L25) 使用变量延迟解析：
```nginx
set $api "api:8080";
proxy_pass http://$api;
```

---

## 6. VPS Docker Build 内存溢出

**现象**：VPS（2GB RAM）上 `docker build` 编译 Go 后端时 OOM，进程被杀死。

**根因**：Go 编译器在 Docker 构建中需要大量内存，2GB VPS 无法承载。

**修复**：确立本地编译流程：
```bash
# 本地（Windows）
cd backend
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server
# 上传到 VPS
scp server root@47.116.137.143:/tmp/server
# 部署到容器
ssh root@47.116.137.143 "chmod +x /tmp/server && docker cp /tmp/server chizi-album-api-1:/server && docker restart chizi-album-api-1"
```

---

## 7. API 重启后 502 Bad Gateway

**现象**：API 容器重启后 Nginx 返回 502。

**根因**：Docker 重启容器后分配新 IP，Nginx 上游缓存了旧 IP 地址。

**修复**：API 重启后同步重启 Nginx：
```bash
docker restart chizi-album-api-1 && sleep 2 && docker restart chizi-album-nginx-1
```
Nginx 配置中的 `set $api` 延迟解析（问题 #5）已解决大部分情况，但重启后重启 Nginx 是兜底措施。

---

## 8. Windows 端口冲突（5432, 6379）

**现象**：`docker compose up` 报端口冲突，无法启动 PostgreSQL 和 Redis。

**根因**：Windows 系统本身占用了 5432 和 6379 端口。

**修复**：[docker-compose.yml](docker-compose.yml) 端口映射改为非标准端口：
```yaml
postgres:
  ports:
    - "127.0.0.1:15432:5432"
redis:
  ports:
    - "127.0.0.1:16379:6379"
```

---

## 9. 中文标签乱码

**现象**：数据库中的标签"打印""点赞"等中文在页面上显示乱码。

**根因**：curl 在 Windows bash 中对中文字符进行非 UTF-8 编码。

**修复**：通过 PowerShell 脚本参数传递中文字符，脚本内部使用 `[System.Web.HttpUtility]::UrlEncode` 进行正确的 URL 编码。

---

## 10. VSCode gopls 安装失败

**现象**：VSCode Go 语言服务器无法安装，日志报 `proxy.golang.org` 连接超时。

**根因**：VSCode Go 扩展安装 gopls 时使用默认 `proxy.golang.org`，该地址在国内被阻断。操作系统的 `GOPROXY` 环境变量覆盖了 `go env -w` 的设置。

**修复**：
```bash
# 删除系统环境变量 GOPROXY（如有），然后用 go env 设置
go env -w GOPROXY=https://goproxy.cn,direct
```
VSCode 重新加载窗口后 gopls 安装成功。

---

## 11. 图库页面只显示 20 张，无分页

**现象**：上传 29 张图片后，图库只显示前 20 张，无法查看第 2 页。

**根因**：前端两处代码写死 `limit: 20` 且无分页组件：
- [GalleryPage.tsx:22-23](frontend/src/pages/gallery/GalleryPage.tsx#L22-L23)
- [LandingPage.tsx:20](frontend/src/pages/LandingPage.tsx#L20)

**修复**：
- [GalleryPage.tsx:2](frontend/src/pages/gallery/GalleryPage.tsx#L2) — 引入 `Pagination` 组件
- [GalleryPage.tsx:40](frontend/src/pages/gallery/GalleryPage.tsx#L40) — 提取 `total` 值
- [GalleryPage.tsx:117-127](frontend/src/pages/gallery/GalleryPage.tsx#L117-L127) — 添加分页器
- [LandingPage.tsx:2](frontend/src/pages/LandingPage.tsx#L2) — 引入 `Pagination` 组件
- [LandingPage.tsx:29](frontend/src/pages/LandingPage.tsx#L29) — 提取 `total` 值
- [LandingPage.tsx:107-117](frontend/src/pages/LandingPage.tsx#L107-L117) — 添加分页器

---

## 12. 单文件 20MB 上传限制

**现象**：需要上传大于 20MB 的图片时被拒绝。

**根因**：后端配置默认 `UPLOAD_MAX_SIZE_MB=20`，前端常量 `UPLOAD_MAX_SIZE_MB=20`。

**修复**：
- [config.go:42](backend/internal/config/config.go#L42) — 默认值从 20 改为 0（0 = 不限）
- [config.go:70](backend/internal/config/config.go#L70) — `getEnvInt64("UPLOAD_MAX_SIZE_MB", 20)` → `getEnvInt64("UPLOAD_MAX_SIZE_MB", 0)`
- [image_service.go:52](backend/internal/service/image_service.go#L52) — 条件从 `size > s.maxSizeMB*1024*1024` 改为 `s.maxSizeMB > 0 && size > s.maxSizeMB*1024*1024`
- [constants.ts:1](frontend/src/utils/constants.ts#L1) — `UPLOAD_MAX_SIZE_MB = 20` → `UPLOAD_MAX_SIZE_GB = 1`
- [UploadPage.tsx:19](frontend/src/pages/upload/UploadPage.tsx#L19) — 更新 import 引用
- [UploadPage.tsx:70](frontend/src/pages/upload/UploadPage.tsx#L70) — 提示文字更新

---

## 13. 同时上传多文件报 "Invalid multipart form"

**现象**：同时上传 15MB + 23MB 两张图，后端返回 "Invalid multipart form"。

**根因**：Gin 默认 `MaxMultipartMemory = 32MB`，15MB + 23MB = 38MB 超过内存缓冲区上限。

**修复**：
- [router.go:35](backend/internal/router/router.go#L35) — `r.MaxMultipartMemory = 500 << 20`（500MB）
- [nginx.conf:21](nginx/nginx.conf#L21) — `client_max_body_size 50m` → `500m`（配合放大入口限制）

> **注意**：500MB 设置在 2GB VPS 上存在 OOM 风险。成熟方案建议换 alpine 镜像 + 64MB 缓冲 + tmpfs 挂载 `/tmp`，详见下方"并发问题"部分。

---

## 14. 上传的图片默认不公开

**现象**：用户上传图片后，其他用户在图库看不到。

**根因**：[image_service.go:116](backend/internal/service/image_service.go#L116) 原本 `isPublic := isAdmin`，即非管理员上传的图片 `is_public = false`。

**修复**：改为 `isPublic := true`，所有上传图片默认公开可见。

---

## 15. Token 刷新不持久

**现象**：浏览器刷新页面后需要重新登录。

**根因**：Zustand 状态仅存内存，刷新丢失。Token 未持久化到 localStorage。

**修复**：[authStore.ts:45-73](frontend/src/pages/auth/authStore.ts#L45-L73)：
- `setAuth()` — 写入 `localStorage` 同时更新状态
- `setAccessToken()` — 仅更新 access_token
- `clearAuth()` — 清除 `localStorage`
- `loadFromStorage()` — 从 `localStorage` 恢复状态
- 初始化时从 `localStorage` 读取存储的 token 和用户信息

---

## 16. Nginx 图片缓存击穿

**现象**：热门图片缓存过期瞬间，大量请求同时回源 MinIO。

**修复**：后续优化项，可在 `proxy_cache_lock on` 串行化回源请求。

---

## 17. 存储配额存在竞态条件

**现象**：用户同时发起两个上传请求，两个都通过配额检查后才更新 `storage_used`，实际使用可能超出配额。

**修复**：后续优化项。方案：用 `SELECT ... FOR UPDATE` 加行锁，或使用 PostgreSQL advisory lock 串行化同一用户的配额检查。

---

## 18. 标签 Toggle 存在竞态条件

**现象**：两个请求同时 toggle 同一标签，都读到 "不存在" 然后都 INSERT，第二条报 PK 违规。

**根因**：[image_service.go:262-281](backend/internal/service/image_service.go#L262-L281) 使用 DELETE → 0 rows → INSERT 模式，不是原子操作。

**修复**：后续优化项。方案：改用 PostgreSQL `ON CONFLICT DO NOTHING` + `ON CONFLICT DO DELETE` 或 `INSERT ... ON CONFLICT (image_id, tag_id, user_id) DO DELETE`。

---

## 19. 打印同步并发冲突

**现象**：后台 5 分钟定时同步 + 管理员手动触发，两个 `SyncTaggedImages` 可能同时运行，导致文件被意外删除。

**根因**：[admin_service.go:36](backend/internal/service/admin_service.go#L36) `SyncTaggedImages` 下载文件到本地并清理过期文件，两个实例同时操作同一目录。

**修复**：后续优化项。方案：用 `sync.RWMutex` + `lastSync` 时间检查，或使用文件锁。

---

## 20. 删除操作顺序问题

**现象**：先 `DELETE FROM images` 再 `RemoveObject`，如果 MinIO 删除失败（网络抖动），数据库记录已消失，MinIO 留孤儿文件。

**根因**：[image_service.go:232-246](backend/internal/service/image_service.go#L232-L246) `HardDelete` 先删库后删文件。

**修复**：后续优化项。方案：先删 MinIO 文件，失败则中止整个操作不删库。或加定时任务扫描 MinIO 中不在数据库里的孤儿对象并清理。

---

## 21. 上传操作顺序问题

**现象**：先 `Upload to MinIO` 再 `INSERT INTO images`，如果 DB 写入失败，MinIO 已有文件。

**根因**：[image_service.go:99-133](backend/internal/service/image_service.go#L99-L133) 先传文件后写库。

**修复**：当前已有部分保护（[image_service.go:128-131](backend/internal/service/image_service.go#L128-L131) — 写库失败时清理已传文件），但清理也可能失败。

---

## 待解决的并发问题汇总

| # | 问题 | 严重度 | 文件:行号 | 状态 |
|---|------|--------|-----------|------|
| 1 | MaxMultipartMemory 500MB 致 OOM | 高 | [router.go:35](backend/internal/router/router.go#L35) | **已缓解**（500MB），待优化 |
| 2 | WriteTimeout 60s 不满足弱网上传 | 中 | [main.go:120](backend/cmd/server/main.go#L120) | 待评估 |
| 3 | worker_connections 1024 防刷 | 低 | [nginx.conf:2](nginx/nginx.conf#L2) | 待评估 |
| 4 | 存储配额竞态 | 高 | [image_service.go:73-82](backend/internal/service/image_service.go#L73-L82) | 待修复 |
| 5 | Toggle 标签竞态 | 高 | [image_service.go:262-281](backend/internal/service/image_service.go#L262-L281) | 待修复 |
| 6 | 删除先删库后删文件 | 中 | [image_service.go:234-245](backend/internal/service/image_service.go#L234-L245) | 待修复 |
| 7 | 上传先传文件后写库 | 中 | [image_service.go:99-133](backend/internal/service/image_service.go#L99-L133) | 已部分保护 |
| 8 | Refresh Token 并发刷新 | 中 | jwt 服务层 | 待评估 |
| 9 | Token 刷新期间上传重试 | 低 | [client.ts:44](frontend/src/api/client.ts#L44) | 待评估 |
| 10 | 打印同步并发冲突 | 中 | [admin_service.go:36](backend/internal/service/admin_service.go#L36) | 待修复 |
| 11 | 优雅关闭 30s 不够 | 低 | [main.go:140](backend/cmd/server/main.go#L140) | 待评估 |
| 12 | PG 连接池 20 不够 | 低 | [main.go:45](backend/cmd/server/main.go#L45) | 待评估 |
| 13 | Nginx 图片缓存击穿 | 低 | [nginx.conf:32-35](nginx/nginx.conf#L32-L35) | 待优化 |
| 14 | 限流 burst 影响上传 | 低 | [nginx.conf:24](nginx/nginx.conf#L24) | 待评估 |

---

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-05-14 | 前端分页器修复（GalleryPage + LandingPage） |
| 2026-05-14 | 上传限制 20MB 解除 |
| 2026-05-14 | MaxMultipartMemory 32MB → 500MB + client_max_body_size 50m → 500m |
| 历史 | 初始开发、多轮 bug 修复 |
