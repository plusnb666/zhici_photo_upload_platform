# 赤子の相册 — 技术栈与技能要求

## 后端 (Go)

| 技能 | 用途 | 掌握程度 |
|---|---|---|
| Go 语言 | 语法、goroutine/channel、接口、错误处理、`embed` | 熟练 |
| Gin | HTTP 路由注册、中间件链、文件上传、参数绑定 | 熟练 |
| pgx v5 | PostgreSQL 驱动，直接写 SQL（无 ORM） | 熟练 |
| golang-jwt/jwt v5 | Access Token + Refresh Token 双令牌签发与验证 | 了解 |
| minio-go SDK v7 | S3 兼容对象存储：上传、下载、预签名 URL、删除 | 了解 |
| golang.org/x/crypto/bcrypt | 密码哈希（cost=12） | 了解 |
| slog | Go 标准库结构化日志 | 了解 |
| modernc.org/sqlite | 纯 Go SQLite（监控平台，无 CGO） | 了解 |
| gopsutil v4 | CPU / 内存 / 磁盘指标采集 | 了解 |

## 前端 Web

| 技能 | 用途 | 掌握程度 |
|---|---|---|
| TypeScript | 类型系统、泛型、接口定义 | 熟练 |
| React 18 | Hooks、组件化、条件渲染、受控/非受控组件 | 熟练 |
| Vite | 构建配置、代理转发、环境变量 | 熟练 |
| Ant Design 5 | Table、Form、Upload、Card、Pagination、Modal、message | 熟练 |
| TanStack Query | useQuery、useMutation、缓存策略、invalidateQueries | 熟练 |
| Zustand | 客户端状态管理，配合 localStorage/AsyncStorage 持久化 | 了解 |
| axios | 请求/响应拦截器，JWT 自动刷新，401 处理 | 了解 |
| framer-motion | 页面过渡、列表动画、手势交互 | 了解 |
| Three.js + @react-three/fiber | 3D 场景渲染（着陆页浮动相册） | 了解 |
| Chart.js | 监控趋势折线图 | 了解 |

## 前端 Mobile (React Native)

| 技能 | 用途 | 掌握程度 |
|---|---|---|
| React Native + Expo SDK 54 | 跨平台 Android/iOS 应用 | 了解 |
| React Navigation | Native Stack Navigator + Bottom Tabs Navigator | 了解 |
| AsyncStorage | 本地 token 持久化 | 了解 |
| expo-image-picker | 相册选择 / 相机拍照 | 了解 |
| XMLHttpRequest | Android `content://` URI 文件上传（fetch 无法处理） | 了解 |
| React Native 原生桥接原理 | 理解 FormData 在不同平台上的序列化差异 | 了解 |

## 基础设施 & 运维

| 技能 | 用途 | 掌握程度 |
|---|---|---|
| Docker | 镜像构建、多阶段构建、Alpine 基础镜像 | 熟练 |
| Docker Compose | 6 服务编排：Nginx + API + PostgreSQL + Redis + MinIO + MinIO-init | 熟练 |
| Nginx | 反向代理、静态文件服务、`client_max_body_size`、限流 `limit_req`、gzip | 了解 |
| PostgreSQL | 表设计、索引、外键、`pg_isready` 健康检查 | 了解 |
| Redis | 令牌桶限流、数据缓存 | 了解 |
| MinIO | S3 兼容对象存储，bucket 创建与匿名访问策略 | 了解 |
| SQLite | 本地时序数据存储，WAL 模式，自动清理 | 了解 |
| systemd | Linux 服务单元编写、自启动、日志管理 | 了解 |
| Linux 基础 | SSH、scp、文件权限、进程管理、磁盘管理 | 了解 |

## 工具链

| 技能 | 用途 |
|---|---|
| Git | 版本控制、分支管理 |
| bash | 本地编译脚本、VPS 部署脚本 |
| PowerShell | Windows 端同步脚本（sync-print.ps1） |
| pnpm / npm | 前端依赖管理 |
| Go modules | 后端依赖管理 |
| curl | API 调试、健康检查 |

---

## 总体画像

一个人要能独立维护这个项目，需要是一个 **全栈工程师**，侧重点：

1. **核心三板斧**: Go + React + TypeScript，这三样必须熟练
2. **次核心**: Docker + PostgreSQL + Nginx，能排查线上问题
3. **够用就行**: Redis、MinIO、React Native、Three.js，知道怎么用、出问题去哪查
4. **加分项**: 运维意识（systemd、日志、监控、资源管理）

不需要每个库都背 API，但需要看得懂文档、改得动代码、排得了错。
