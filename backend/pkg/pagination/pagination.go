package pagination

type PaginatedResponse struct {
	Items interface{} `json:"items"`
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

func Offset(page, limit int) int {
	if page <= 0 {
		page = 1
	}
	return (page - 1) * limit
}
