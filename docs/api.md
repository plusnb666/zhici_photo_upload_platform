# API 文档

基础地址：`http://localhost/api/v1`（开发）/ `http://47.116.137.143:8080/api/v1`（生产）

## 认证方式

在请求头中携带 JWT：

```
Authorization: Bearer <access_token>
```

Access Token 有效期 15 分钟，过期后用 Refresh Token 换取新的，无需重新登录。前端 axios 拦截器自动处理 401 → 刷新 → 重试。

## 通用响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

| code | 含义 |
|---|---|
| 0 | 成功 |
| 401 | 未认证或 Token 过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

## 认证 `/auth`

### 注册

```
POST /auth/register
```

```json
// 请求
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "secure123"
}

// 响应
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "user"
  }
}
```

限流：3 次/分钟。

### 登录

```
POST /auth/login
```

```json
// 请求
{
  "email": "alice@example.com",
  "password": "secure123"
}

// 响应
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "eyJhbG...",
    "refresh_token": "dGhpcyBp...",
    "user": {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "role": "user",
      "storage_used": 0
    }
  }
}
```

限流：10 次/分钟。

### 刷新令牌

```
POST /auth/refresh
```

```json
// 请求
{
  "refresh_token": "dGhpcyBp..."
}

// 响应
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "eyJhbG...",
    "refresh_token": "bmV3IHJl..."
  }
}
```

旧的 Refresh Token 立即吊销，每次刷新都会轮换。

### 登出

```
POST /auth/logout
```

```json
// 请求
{
  "refresh_token": "dGhpcyBp..."
}

// 响应
{
  "code": 0,
  "message": "success"
}
```

### 当前用户

```
GET /auth/me
Authorization: Bearer <token>
```

```json
// 响应
{
  "code": 0,
  "data": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "user",
    "storage_used": 1048576,
    "created_at": "2025-12-01T10:00:00Z"
  }
}
```

## 公开 `/public`

无需认证。

### 公开图库列表

```
GET /public/images?page=1&limit=20&tag=风景
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `page` | int | 否 | 页码，默认 1 |
| `limit` | int | 否 | 每页数量，默认 20 |
| `tag` | string | 否 | 按标签名过滤 |

```json
// 响应
{
  "code": 0,
  "data": {
    "images": [
      {
        "id": 42,
        "user_id": 1,
        "username": "alice",
        "filename": "sunset.jpg",
        "mime_type": "image/jpeg",
        "file_size": 204800,
        "width": 1920,
        "height": 1080,
        "view_count": 15,
        "url": "http://localhost/images/1/sunset_1700000000.jpg",
        "thumbnail_url": "http://localhost/images/1/sunset_1700000000_thumb.jpg",
        "tags": [
          { "id": 1, "name": "风景", "color": "#52c41a" }
        ],
        "created_at": "2025-12-15T08:30:00Z"
      }
    ],
    "total": 42
  }
}
```

### 公开图片详情

```
GET /public/images/42
```

```json
// 响应
{
  "code": 0,
  "data": {
    "id": 42,
    "filename": "sunset.jpg",
    "url": "http://localhost/images/1/sunset_1700000000.jpg",
    "tags": [...],
    "view_count": 16
  }
}
```

每次访问 `view_count` 自动 +1。

### 公开评论列表

```
GET /public/images/42/comments
```

```json
// 响应
{
  "code": 0,
  "data": [
    {
      "id": 5,
      "image_id": 42,
      "user_id": 2,
      "username": "bob",
      "content": "这张拍得真好",
      "created_at": "2025-12-15T09:00:00Z"
    }
  ]
}
```

## 图片 `/images`

需要认证。

### 上传

```
POST /images/upload
Content-Type: multipart/form-data
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `files` | file[] | 是 | 图片文件，支持多文件 |
| `tags` | string | 否 | JSON 字符串数组，如 `["风景","收藏"]` |

```
// 请求示例 (curl)
curl -X POST http://localhost/api/v1/images/upload \
  -H 'Authorization: Bearer <token>' \
  -F 'files=@photo1.jpg' \
  -F 'files=@photo2.png' \
  -F 'tags=["风景","收藏"]'
```

```json
// 响应
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 43,
      "filename": "photo1.jpg",
      "url": "http://localhost/images/1/photo1_1700000001.jpg"
    },
    {
      "id": 44,
      "filename": "photo2.png",
      "url": "http://localhost/images/1/photo2_1700000002.png"
    }
  ]
}
```

允许的 MIME 类型：`image/png` · `image/jpeg` · `image/gif` · `image/webp` · `image/bmp`。限流：30 次/分钟。

### 我的图片列表

```
GET /images?page=1&limit=20&tag=风景
```

响应格式同 `GET /public/images`。

### 图片详情

```
GET /images/42
```

响应格式同 `GET /public/images/42`，额外包含 `storage_key` 字段。

### 下载

```
GET /images/42/download
```

返回文件流，响应头：

```
Content-Disposition: attachment; filename*=UTF-8''sunset.jpg
Content-Type: image/jpeg
```

中文文件名使用 RFC 5987 编码。

### 更新元数据

```
PATCH /images/42
```

```json
// 请求
{
  "filename": "new-name.jpg",
  "alt_text": "日落照片"
}
```

### 删除

```
DELETE /images/42
```

硬删除：同步删除数据库记录 + MinIO 文件 + 缩略图。

### 批量删除

```
POST /images/batch-delete
```

```json
// 请求
{
  "ids": [42, 43, 44]
}
```

### 添加标签

```
POST /images/42/tags
```

```json
// 请求
{
  "tag_ids": [1, 2]
}
```

### 移除标签

```
DELETE /images/42/tags/1
```

### 切换标签（点赞模式）

```
POST /images/42/toggle-tag
```

```json
// 请求
{
  "tag_id": 1
}

// 标签不存在时 → 添加，返回 { "action": "added" }
// 标签已存在时 → 移除，返回 { "action": "removed" }
```

### 评论列表

```
GET /images/42/comments
```

### 创建评论

```
POST /images/42/comments
```

```json
// 请求
{
  "content": "拍得真好！"
}

// 响应
{
  "code": 0,
  "data": {
    "id": 6,
    "image_id": 42,
    "user_id": 1,
    "username": "alice",
    "content": "拍得真好！",
    "created_at": "2025-12-15T10:30:00Z"
  }
}
```

评论内容 1-500 字符。

### 删除评论

```
DELETE /images/42/comments/6
```

仅评论作者或管理员可删除。

## 标签 `/tags`

需要认证。

### 标签列表

```
GET /tags
```

```json
// 响应
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "name": "风景",
      "color": "#52c41a",
      "count": 23
    }
  ]
}
```

包含每个标签的使用次数。

### 创建标签

```
POST /tags
```

```json
// 请求
{
  "name": "壁纸",
  "color": "#1890ff"
}
```

标签重名时 upsert（更新颜色）。

### 删除标签

```
DELETE /tags/1
```

仅管理员可操作。

## 管理 `/admin`

需要 admin 角色。

### 总览统计

```
GET /admin/stats
```

```json
// 响应
{
  "code": 0,
  "data": {
    "total_users": 12,
    "total_images": 156,
    "total_storage_bytes": 524288000,
    "today_uploads": 3
  }
}
```

### 标签统计

```
GET /admin/stats/tags
```

返回 Top 标签及已标记图片数。

### 上传统计

```
GET /admin/stats/upload-trend
```

返回最近 30 天每天的上传数量（含零值填充）。

### 用户列表

```
GET /admin/users?page=1&limit=20&search=alice
```

```json
// 响应
{
  "code": 0,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "role": "user",
        "storage_used": 1048576,
        "created_at": "2025-12-01T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

### 修改用户角色

```
PATCH /admin/users/1
```

```json
// 请求
{
  "role": "admin"
}
```

### 重置用户密码

```
PATCH /admin/users/1/password
```

```json
// 请求
{
  "password": "newpassword123"
}
```

密码至少 6 个字符。

### 全局图片管理

```
GET /admin/images?page=1&limit=20
```

### 强制删除图片

```
DELETE /admin/images/42
```

软删除（仅标记 deleted_at）。

### 同步打印图片

```
POST /admin/sync?tag=打印
```

将指定标签的图片同步到容器内 `/exports` 目录。

## 健康检查

### 存活探针

```
GET /api/health
→ 200 OK
```

### 就绪探针

```
GET /api/health/ready
```

```json
// 正常
{
  "status": "ready",
  "database": "ok",
  "redis": "ok",
  "storage": "ok"
}

// 异常
{
  "status": "not ready",
  "database": "ok",
  "redis": "error: connection refused",
  "storage": "ok"
}
```
