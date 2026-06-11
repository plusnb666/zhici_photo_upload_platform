# 配置参考

所有配置通过环境变量注入。开发环境默认值见 `docker-compose.yml`，生产环境见 `docker-compose.vps.yml`。

## 环境变量

### 应用配置

| 变量 | 默认值 | 必改 | 说明 |
|---|---|---|---|
| `APP_ENV` | `development` | 否 | `development` → 文本日志、全 CORS；`production` → JSON 日志 |
| `APP_PORT` | `8080` | 否 | HTTP 监听端口 |

### 数据库

| 变量 | 默认值 | 必改 | 说明 |
|---|---|---|---|
| `DB_HOST` | `localhost` | 否 | PostgreSQL 地址 |
| `DB_PORT` | `5432` | 否 | PostgreSQL 端口 |
| `DB_USER` | `imgplatform` | 否 | 数据库用户名 |
| `DB_PASSWORD` | `devpassword` | 🔴 **生产必改** | 数据库密码 |
| `DB_NAME` | `imgplatform` | 否 | 数据库名 |

### Redis

| 变量 | 默认值 | 必改 | 说明 |
|---|---|---|---|
| `REDIS_HOST` | `localhost` | 否 | Redis 地址 |
| `REDIS_PORT` | `6379` | 否 | Redis 端口 |

> Redis 不可用时服务不会中断 — 限流降级为放行所有请求。

### 对象存储 (MinIO / S3)

| 变量 | 默认值 | 必改 | 说明 |
|---|---|---|---|
| `S3_ENDPOINT` | `localhost:9000` | 否 | S3 兼容存储地址 |
| `S3_ACCESS_KEY` | `minioadmin` | 🔴 **生产必改** | Access Key |
| `S3_SECRET_KEY` | `minioadmin` | 🔴 **生产必改** | Secret Key |
| `S3_BUCKET` | `images` | 否 | 存储桶名称 |
| `S3_USE_SSL` | `false` | 否 | 是否使用 HTTPS 连接 S3 |
| `CDN_BASE_URL` | 空 | 生产设置 | CDN 加速域名，如 `http://47.116.137.143:8080/images`。设置后图片 URL 直接拼接而非生成预签名地址 |

> S3 不可用时服务降级为本地存储（`./uploads/` 目录），不中断运行。

### 安全

| 变量 | 默认值 | 必改 | 说明 |
|---|---|---|---|
| `JWT_SECRET` | `dev-secret-key-do-not-use-in-production` | 🔴 **生产必改** | JWT 签名密钥，至少 32 字符随机字符串 |

```bash
# 生成随机密钥
openssl rand -base64 32
```

### 上传限制

| 变量 | 默认值 | 必改 | 说明 |
|---|---|---|---|
| `UPLOAD_MAX_SIZE_MB` | `200` | 否 | 单次上传请求体上限（MB）。需同步修改 Nginx `client_max_body_size` |
| `STORAGE_QUOTA_GB` | `5` | 否 | 普通用户存储配额（GB）。管理员无限制 |

### 镜像标签

| 变量 | 默认值 | 说明 |
|---|---|---|
| `POSTGRES_TAG` | `16-alpine` | PostgreSQL 镜像版本 |
| `REDIS_TAG` | `7-alpine` | Redis 镜像版本 |
| `MINIO_TAG` | `latest` | MinIO 镜像版本 |

## Nginx 配置

Nginx 配置位于 [nginx/nginx.conf](../nginx/nginx.conf)，需同步修改的项：

| 配置项 | 值 | 说明 |
|---|---|---|
| `client_max_body_size` | `200m` | 需与 `UPLOAD_MAX_SIZE_MB` 一致或更大 |
| `limit_req_zone rate` | `30r/s` | API 限流速率 |
| `proxy_pass /api/` | `http://api:8080` | 后端 API 代理 |
| `proxy_pass /images/` | `http://minio:9000/images/` | MinIO 图片直连 |

## 配置优先级

1. 环境变量（最高）
2. `.env` 文件（Docker Compose 自动加载）
3. 代码内置默认值（最低）

## 修改后需要重启的服务

| 修改的变量 | 重启服务 |
|---|---|
| 数据库相关 | `api`, `postgres` |
| Redis 相关 | `api` |
| S3 相关 | `api` |
| JWT_SECRET | `api`（所有用户需重新登录） |
| 上传限制 | `api`, `nginx` |
| Nginx 配置 | `nginx` |

```bash
docker compose restart api nginx
```
