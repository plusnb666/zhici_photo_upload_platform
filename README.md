# 赤子の相册

轻量级图床平台 — 上传、浏览、标记、管理图片。Web + Android 双端，Docker 一键部署。

## 核心功能

- **上传**：拖拽/点选上传，支持 PNG · JPEG · GIF · WebP · BMP，自动生成缩略图，单次上限 200MB
- **公开浏览**：所有图片默认公开，无需登录即可浏览、搜索、按标签筛选
- **标签系统**：预设标签 + 自定义标签，点击切换（点赞模式），共享标签池
- **评论**：图片详情页支持评论互动
- **管理后台**：总览统计、上传统计、标签统计、用户管理（含密码重置）、图片管理
- **移动端**：React Native Android 应用，支持相机拍照上传、图库浏览、评论
- **服务器监控**：独立监控平台（端口 9090），CPU / 内存 / 磁盘趋势，90 天保留

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 后端 | Go · Gin · pgx | 1.23+ |
| 数据库 | PostgreSQL | 16 |
| 缓存 | Redis | 7 |
| 对象存储 | MinIO（S3 兼容） | latest |
| 前端 Web | React · TypeScript · Vite · Ant Design 5 · TanStack Query · Zustand · framer-motion | 19 |
| 移动端 | React Native · Expo SDK 54 · Zustand · React Navigation | — |
| 代理 | Nginx | 1.25 |
| 部署 | Docker Compose（6 服务） | — |
| 监控 | gopsutil · SQLite · Chart.js | — |

## 架构

```
 Browser / Mobile App
        │
    Nginx (:80/:8080)
    ┌───┴───────────────┐
    │ /api/*   → Go API │  Gin · JWT · 限流
    │ /images/* → MinIO │  直接代理对象存储
    │ /*       → 静态文件 │  React SPA
    └───────────────────┘
          │         │
     PostgreSQL    Redis
    (元数据·用户)  (限流·缓存)

   MinIO (图片文件)     Monitor (:9090)
                         gopsutil · SQLite
```

## 项目结构

```
├── backend/            Go API 服务
├── frontend/           React Web 前端
├── mobile/             React Native Android 应用
├── monitor/            VPS 监控平台（独立服务）
├── nginx/              Nginx 反向代理配置
├── scripts/            同步脚本
├── docs/               技术文档
├── docker-compose.yml          本地开发
├── docker-compose.vps.yml      VPS 生产
└── docker-compose.prod.yml     通用生产模板
```

## 快速开始

详见 [docs/quickstart.md](docs/quickstart.md)

```bash
# 1. 构建前端
cd frontend && npm install && npm run build

# 2. 启动所有服务
cd .. && docker compose up -d

# 3. 访问
# http://localhost
```

## 文档

| 文档 | 适用对象 |
|---|---|
| [快速开始](docs/quickstart.md) | 想运行项目的人 |
| [配置参考](docs/configuration.md) | 部署和维护者 |
| [API 文档](docs/api.md) | 前端开发者、API 调用方 |
| [架构设计](docs/architecture.md) | 维护者、技术评审 |
| [开发指南](docs/development.md) | 贡献者 |
| [技术栈要求](docs/tech-stack-requirements.md) | 新成员、技术评估 |

## 许可证

MIT
