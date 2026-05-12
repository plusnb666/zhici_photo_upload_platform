.PHONY: dev build clean migrate-up migrate-down test

dev:
	docker-compose up --build

build:
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o server ./cmd/server

clean:
	docker-compose down -v

migrate-up:
	cd backend && go run ./cmd/migrate up

migrate-down:
	cd backend && go run ./cmd/migrate down

test:
	cd backend && go test ./...
