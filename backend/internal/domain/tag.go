// 领域实体：Tag
// 标签采用「点赞模式」：预定义标签，用户点击切换（toggle）
// 同一用户对同一图片的同一标签只能标记一次：唯一约束 (image_id, tag_id, user_id)
package domain

import "time"

type Tag struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`            // 标签名
	Color     string    `json:"color"`           // 前端显示色值，如 #ff4d4f
	CreatedAt time.Time `json:"created_at"`
	Count     int64     `json:"count,omitempty"`  // 该标签被标记的总次数（查询时聚合）
	Active    bool      `json:"active,omitempty"` // 当前用户是否已标记此标签（仅查询自己的图片时有值）
}
