# 快速开始

10 分钟内让项目在本地跑起来。

## 前置条件

| 软件 | 最低版本 | 用途 |
|---|---|---|
| Docker Desktop | 24+ | 容器运行时 |
| Go | 1.23+ | 后端开发（仅需改后端时必要） |
| Node.js | 18+ | 前端构建 |
| pnpm | 推荐 | 比 npm 更快 |

## 1. 构建前端

```bash
cd frontend
npm install        # 或 pnpm install
npm run build
```

成功后终端输出 `✓ built in ...`，前端产物在 `frontend/dist/`。

## 2. 启动所有服务

```bash
cd ..
docker compose up -d
```

6 个容器按依赖顺序启动：PostgreSQL → Redis → MinIO → MinIO-init → API → Nginx。

验证运行状态：

```bash
docker compose ps
# 所有服务 STATUS 均为 Up / healthy
```

## 3. 访问

打开浏览器访问 **http://localhost**

预期看到赤子の相册首页（公开图库 3D 视图）。

## 4. 创建管理员账号

```bash
# 注册
curl -X POST http://localhost/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","email":"admin@example.com","password":"admin123"}'

# 提升为管理员
docker exec -i $(docker compose ps -q postgres) \
  psql -U imgplatform -d imgplatform \
  -c "UPDATE users SET role='admin' WHERE email='admin@example.com';"
```

返回浏览器，右上角登录 `admin@example.com` / `admin123`，左侧栏出现「管理」入口。

## 5. 上传第一张图片

- 点击「上传」或访问 http://localhost/upload
- 拖拽图片到上传区，支持多文件
- 点击上传，完成后自动跳回图库

## 常见问题

### 端口被占用

| 端口 | 用途 | 冲突处理 |
|---|---|---|
| 80 | Nginx | 停止本地 IIS / 其他 Web 服务 |
| 5432 | PostgreSQL | 已在本地映射为 `127.0.0.1:15432`，通常不冲突 |
| 6379 | Redis | 已在本地映射为 `127.0.0.1:16379`，通常不冲突 |
| 9000 | MinIO S3 | 停止本地其他 S3 类服务 |
| 9001 | MinIO Console | 可注释掉 docker-compose.yml 该端口映射 |

### MinIO-init 容器 Exited(0)

正常。该容器只做一次 bucket 初始化，完成后退出，状态 `Exited (0)` 表示成功。

### 浏览器显示白屏

1. 确认 `frontend/dist/` 目录存在且有 index.html
2. `docker compose restart nginx`
3. 打开浏览器 DevTools → Network，看具体哪个请求失败

### 图片上传失败 "Invalid multipart form"

文件大小超过 200MB 限制被 Nginx 拒绝。单次上传压缩图片或分批上传。

### API 返回 500

```bash
docker compose logs api | tail -50
```

常见原因：数据库未就绪（重启后 postgres 初始化有时间差），等待 10 秒后自动恢复。

## 仅改前端时

不需要重启后端容器，只需重新构建：

```bash
cd frontend && npm run build
# 刷新浏览器
```

## 仅改后端时

```bash
cd backend
go run ./cmd/server          # 直接启动，连接容器中的 DB/Redis/MinIO
# 或
docker compose restart api   # 容器中重启
```

后端默认连 `localhost:15432` (PostgreSQL) 和 `localhost:16379` (Redis)，覆盖环境变量：

```powershell
# Windows PowerShell
$env:DB_PORT=15432
$env:REDIS_PORT=16379
go run ./cmd/server
```

## 停止服务

```bash
docker compose down          # 保留数据卷
docker compose down -v       # 删除数据卷（重置所有数据）
```

## 下一步

- [配置参考](configuration.md) — 了解所有环境变量
- [API 文档](api.md) — 接口详情和调用示例
- [开发指南](development.md) — 本地开发环境搭建
