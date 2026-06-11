# 开发指南

给想贡献代码或二次开发的人。

## 本地开发环境

### 不依赖 Docker 的跑法

Docker 启动基础设施（DB/Redis/MinIO），Go 和前端在宿主机直接跑，方便热重载和断点调试。

```bash
# 1. 启动基础设施
docker compose up -d postgres redis minio minio-init

# 2. 启动后端（Windows PowerShell）
cd backend
$env:DB_PORT=15432
$env:REDIS_PORT=16379
go run ./cmd/server

# 3. 启动前端（另一个终端）
cd frontend
npm run dev
# Vite 代理到 localhost:8080，访问 http://localhost:5173
```

### 项目结构规范

```
backend/
├── cmd/server/main.go          # 入口：初始化 → 注册路由 → 启动
├── internal/
│   ├── config/                 # 环境变量加载（Viper 风格，手写）
│   ├── domain/                 # 领域实体 struct，带 json/db tag
│   ├── handler/                # HTTP 处理器：参数绑定 → 调 service → 写响应
│   ├── middleware/             # Gin 中间件：auth, admin, cors, logger, ratelimit
│   ├── repository/             # 数据访问层（早期创建，实际未大量使用）
│   ├── router/                 # 路由注册 + 依赖注入装配
│   ├── service/                # 业务逻辑：校验 → 数据库操作 → 返回
│   └── storage/                # 文件存储抽象：接口 + S3 实现 + 本地实现
├── pkg/                        # 可复用工具包
│   ├── jwt/                    # JWT 签发和验证
│   ├── response/               # 统一 JSON 响应
│   └── pagination/             # 分页参数解析
└── Dockerfile                  # 多阶段构建
```

### 添加新功能的流程

以「添加图片点赞功能」为例：

1. **domain** — 若需要新实体（如 `like.go`），定义 struct
2. **handler** — 新建处理器文件，实现 `func (h *XxxHandler) Like(c *gin.Context)`
3. **service** — 新建或扩展现有 service，实现业务逻辑（校验 + DB 操作）
4. **router** — 注册路由，注入依赖
5. **main.go** — 若有新表，添加 `CREATE TABLE IF NOT EXISTS`

### 代码约定

**Go：**
- 包名全小写，无下划线：`handler`, `middleware`, `response`
- 错误处理：统一返回 `error`，在 handler 层转换为 HTTP 状态码
- SQL：直接写在 service 中，用 `$1, $2` 参数化，不拼接字符串
- 日志：用 `slog.Info/Error`，不用 `fmt.Println`

**TypeScript / React：**
- 文件命名 PascalCase 用于组件：`GalleryPage.tsx`
- API 模块放在 `src/api/`，与后端 endpoint 一一对应
- 状态管理：服务端状态用 TanStack Query，客户端状态用 Zustand
- 不写 `any`，用具体类型或 `unknown` + 类型守卫

### 数据库变更

项目不使用迁移工具，采用**幂等 SQL** 直接写在 `main.go` 中：

```go
db.Exec(`CREATE TABLE IF NOT EXISTS xxx (...);`)
```

添加新表时：
1. 在 `main.go` 的 `runMigrations()` 中添加 `CREATE TABLE IF NOT EXISTS`
2. 所有变更必须幂等（可重复执行不报错）

### 对象存储切换

`internal/storage/storage.go` 定义了 `FileStorage` 接口：

```go
type FileStorage interface {
    Upload(ctx context.Context, key string, data []byte, mime string) error
    Delete(ctx context.Context, key string) error
    GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error)
}
```

当前实现：
- `S3Storage` — MinIO / AWS S3 / 阿里云 OSS / 腾讯云 COS / Cloudflare R2
- `LocalStorage` — S3 连接失败时的自动降级，文件存 `./uploads/`

添加新的存储后端只需实现该接口，然后在 `main.go` 的初始化逻辑中注册。

## 测试

目前无自动化测试。手动测试方法：

```bash
# 健康检查
curl http://localhost:8080/api/health

# 注册
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"test","email":"test@test.com","password":"test123"}'

# 登录（获取 token）
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test123"}'

# 上传（替换 <token>）
curl -X POST http://localhost:8080/api/v1/images/upload \
  -H 'Authorization: Bearer <token>' \
  -F 'files=@test.jpg'
```

## 部署

详见 README 的部署章节。核心流程：

```bash
# 1. 本地编译前端
cd frontend && npm run build

# 2. 本地编译后端二进制（跨平台编译 Linux）
cd backend
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

# 3. 上传到 VPS
scp -r ../frontend/dist root@<VPS>:/opt/chizi-album/frontend/
scp server root@<VPS>:/tmp/
ssh root@<VPS> "mv /tmp/server /opt/chizi-album/backend/server"

# 4. VPS 上重启
ssh root@<VPS> "cd /opt/chizi-album && docker compose -f docker-compose.vps.yml up -d --build"
```

### 为什么本地编译而不是在 VPS 上 docker build？

VPS 通常只有 2GB 内存，Docker 内 `go build` 会触发 OOM Killer。本地编译（`CGO_ENABLED=0 GOOS=linux` 交叉编译）+ scp 上传既快又稳。

## 监控平台

独立项目，代码在 `monitor/`：

```bash
# 本地测试
cd monitor
go run .

# VPS 部署
cd monitor
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o monitor .
scp monitor root@<VPS>:/opt/monitor/monitor
ssh root@<VPS> "systemctl restart monitor"
```

前端页面通过 Go `embed` 嵌入二进制，单文件部署。

监控数据存 SQLite（`monitor/metrics.db`），每 60 秒采集一次，保留 90 天。
