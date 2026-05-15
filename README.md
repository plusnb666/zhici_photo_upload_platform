# 赤子の相册

一个轻量级图床平台，支持图片上传、预览、下载、标签标记，后台管理监控，适用于小团队或公开图库场景。

## 功能

- **图片上传**：拖拽上传，支持 PNG/JPEG/GIF/WebP/BMP，自动生成缩略图
- **公开图库**：所有图片默认公开，无需登录即可浏览
- **标签系统**：预设标签（点赞/收藏/好看/有趣/优秀）+ 自定义标签，点击切换
- **图片下载**：下载时强制浏览器弹窗保存
- **管理后台**：总览统计、30 天上传统计、标签统计、用户管理、图片管理
- **打印同步**：标记为「打印」的图片自动同步到本地文件夹 `D:\print_images\`
- **持久登录**：Token 存储至浏览器 localStorage，刷新不丢

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 1.23+ · Gin · pgx · PostgreSQL 16 |
| 前端 | React 18 · TypeScript · Ant Design 5 · TanStack Query · Zustand |
| 存储 | MinIO（兼容 S3，可切换阿里云 OSS / AWS S3 / Cloudflare R2） |
| 缓存 | Redis 7（限流 · 会话） |
| 代理 | Nginx（反向代理 · 静态文件 · 图片缓存） |
| 部署 | Docker Compose（6 个服务） |

## 项目结构

```
image_upload_platform/
├── docker-compose.yml              # 本地开发部署
├── docker-compose.vps.yml          # VPS 生产部署
├── docker-compose.prod.yml         # 通用生产模板
│
├── backend/                        # Go 后端
│   ├── cmd/server/main.go          # 入口：初始化 → 路由 → 优雅关闭
│   ├── internal/
│   │   ├── config/config.go        # 环境变量配置（12-Factor）
│   │   ├── domain/                 # 领域实体：User, Image, Tag
│   │   ├── handler/                # HTTP 处理器：auth, image, tag, admin, health
│   │   ├── middleware/             # 中间件：JWT 认证, 角色鉴权, 限流, CORS
│   │   ├── router/router.go        # 路由注册 + 依赖注入
│   │   ├── service/                # 业务逻辑：认证, 图片上传, 标签, 管理, 同步
│   │   └── storage/                # 对象存储抽象：S3/MinIO 实现 + 本地兜底
│   ├── pkg/
│   │   ├── jwt/jwt.go              # JWT 签发/验证（双令牌：access 15min + refresh 7d）
│   │   ├── response/response.go    # 统一 JSON 响应格式
│   │   ├── errcode/                # 错误码定义
│   │   └── pagination/             # 分页工具
│   ├── db/migrations/              # SQL 迁移文件
│   ├── Dockerfile                  # 多阶段构建（scratch 镜像，~16MB）
│   └── Dockerfile.dev              # 开发用热重载（Air）
│
├── frontend/                       # React 前端
│   └── src/
│       ├── App.tsx                 # 路由入口
│       ├── api/client.ts           # Axios 实例 + Token 自动刷新
│       ├── store/authStore.ts      # Zustand 认证状态（localStorage 持久化）
│       ├── pages/                  # 页面组件
│       │   ├── LandingPage.tsx     # 首页公开图库
│       │   ├── auth/               # 登录 · 注册
│       │   ├── gallery/            # 图库（全部 + 我的上传）· 图片详情
│       │   ├── upload/             # 拖拽上传
│       │   ├── admin/              # 管理仪表盘 · 用户管理 · 图片管理
│       │   └── profile/            # 个人中心
│       ├── components/             # 公共组件：布局 · 路由守卫
│       └── utils/                  # 工具函数 · 常量
│
├── nginx/nginx.conf                # Nginx 配置
├── scripts/
│   └── sync-print.ps1             # 打印图片同步脚本（PowerShell）
└── .env.example                    # 环境变量模板
```

## 数据库表

| 表 | 说明 | 核心字段 |
|---|---|---|
| `users` | 用户 | username, email, password_hash(bcrypt), role(user/admin), storage_used |
| `images` | 图片 | filename, storage_key, mime_type, file_size, is_public, deleted_at(软删除) |
| `tags` | 标签 | name(unique), color |
| `image_tags` | 图片-标签关联 | PK: (image_id, tag_id, user_id)，同一用户同一标签只能标记一次 |
| `refresh_tokens` | 刷新令牌 | token_hash(SHA-256), expires_at, revoked |

## API 端点

### 认证 `/api/v1/auth`
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册 |
| POST | `/auth/login` | 登录，返回 access_token + refresh_token |
| POST | `/auth/refresh` | 刷新 access token |
| POST | `/auth/logout` | 登出，吊销 refresh token |
| GET | `/auth/me` | 当前用户信息（需认证） |

### 公开 `/api/v1/public`
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/public/images` | 公开图库列表（分页 + 标签筛选） |
| GET | `/public/images/:id` | 公开图片详情 |

### 图片 `/api/v1/images`（需认证）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/images/upload` | 上传（多文件 multipart） |
| GET | `/images` | 我的图片列表 |
| GET | `/images/:id` | 图片详情 |
| GET | `/images/:id/download` | 下载（Content-Disposition: attachment） |
| DELETE | `/images/:id` | 硬删除（同步删数据库 + MinIO 文件） |
| PATCH | `/images/:id` | 更新元数据 |
| POST | `/images/:id/tags` | 添加标签 |
| DELETE | `/images/:id/tags/:tagId` | 移除标签 |
| POST | `/images/:id/toggle-tag` | 切换标签（点赞模式） |

### 标签 `/api/v1/tags`（需认证）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tags` | 标签列表（含使用计数） |
| POST | `/tags` | 创建标签 |
| DELETE | `/tags/:id` | 删除标签（仅管理员） |

### 管理 `/api/v1/admin`（需 admin 角色）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/stats` | 总览统计（用户数/图片数/存储/今日上传） |
| GET | `/admin/stats/tags` | 标签统计（Top 标签 + 已标记图片数） |
| GET | `/admin/stats/upload-trend` | 30 天上传统计 |
| POST | `/admin/sync?tag=打印` | 手动同步打印图片到 /exports |
| GET | `/admin/users` | 用户列表（分页 + 搜索） |
| PATCH | `/admin/users/:id` | 修改用户角色 |
| GET | `/admin/images` | 全局图片管理 |
| DELETE | `/admin/images/:id` | 强制删除图片 |

### 健康检查
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 进程存活 |
| GET | `/api/health/ready` | DB + Redis + S3 就绪 |

## 快速开始

### 前置条件

- Docker Desktop（含 Docker Compose）
- Go 1.23+（仅后端开发需要）
- Node.js 18+（仅前端开发需要）

### 1. 启动服务

```bash
# 构建前端
cd frontend && npm install && npm run build

# 启动所有服务（PostgreSQL + Redis + MinIO + Go API + Nginx）
cd .. && docker compose up -d
```

访问 `http://localhost`。

### 2. 创建管理员

```bash
# 注册账号
curl -X POST http://localhost/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"admin@example.com","password":"admin123"}'

# 提升为管理员
docker exec image_upload_platform-postgres-1 \
  psql -U imgplatform -d imgplatform \
  -c "UPDATE users SET role='admin' WHERE email='admin@example.com';"
```

### 3. 打印同步

```powershell
# 手动执行
powershell -ExecutionPolicy Bypass -File scripts/sync-print.ps1 -TagName "打印"
```

同步脚本将标记为「打印」的图片下载到 `D:\print_images\`，标签取消后自动清理。

## 部署到 VPS

### 1. 准备 VPS

- 系统 Ubuntu 22.04/24.04
- 安装 Docker，配置国内镜像加速
- 安全组放行端口 `80`、`8080`

### 2. 构建并上传

```bash
# 构建前端
cd frontend && npm run build

# 上传项目到 VPS
scp -r . root@<VPS_IP>:/opt/chizi-album/

# 本地编译后端二进制（VPS 2GB 以下不建议在 VPS 上编译）
cd backend
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server
scp server root@<VPS_IP>:/tmp/
ssh root@<VPS_IP> "docker cp /tmp/server chizi-album-api-1:/server && docker restart chizi-album-api-1"
```

### 3. 启动

```bash
ssh root@<VPS_IP>
cd /opt/chizi-album
docker compose -f docker-compose.vps.yml up -d
```

## 配置

所有配置通过环境变量注入，开发时默认值见 `.env.example`。

| 变量 | 默认 | 说明 |
|---|---|---|
| `APP_ENV` | development | development / production |
| `APP_PORT` | 8080 | HTTP 端口 |
| `DB_HOST` | localhost | PostgreSQL 地址 |
| `DB_USER` | imgplatform | 数据库用户 |
| `DB_PASSWORD` | devpassword | 数据库密码 |
| `REDIS_HOST` | localhost | Redis 地址 |
| `S3_ENDPOINT` | localhost:9000 | MinIO / OSS / S3 地址 |
| `S3_BUCKET` | images | 存储桶名称 |
| `JWT_SECRET` | change-me | JWT 密钥，生产必须更换 |
| `CDN_BASE_URL` | 空 | CDN 前缀，如 `http://IP:8080/images` |
| `UPLOAD_MAX_SIZE_MB` | 20 | 单文件上传上限（MB） |
| `STORAGE_QUOTA_GB` | 5 | 普通用户配额（admin 无限制） |

## 性能优化

- **Nginx 图片缓存**：`proxy_cache` 对 `/images/` 路径缓存 7 天，重复图片请求直接从内存返回
- **Admin 无限存储**：管理员上传不检查配额
- **本地编译部署**：VPS 内存小于 4GB 时，建议本地编译再上传二进制，避免 Docker build 过程 OOM

## 许可证

MIT
