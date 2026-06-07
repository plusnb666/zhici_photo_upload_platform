package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"log"
	"net/http"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	_ "modernc.org/sqlite"
)

//go:embed frontend.html
var frontend embed.FS

var db *sql.DB
var startTime = time.Now()

type Metric struct {
	CPUPercent  float64 `json:"cpu_percent"`
	MemPercent  float64 `json:"mem_percent"`
	MemUsedMB   uint64  `json:"mem_used_mb"`
	MemTotalMB  uint64  `json:"mem_total_mb"`
	DiskPercent float64 `json:"disk_percent"`
	DiskUsedGB  float64 `json:"disk_used_gb"`
	DiskTotalGB float64 `json:"disk_total_gb"`
	UptimeHours float64 `json:"uptime_hours"`
	CreatedAt   string  `json:"created_at"`
}

func main() {
	var err error
	db, err = sql.Open("sqlite", "file:metrics.db?_journal=WAL&_busy_timeout=1000")
	if err != nil {
		log.Fatal("open db:", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS metrics (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cpu_percent REAL NOT NULL,
		mem_percent REAL NOT NULL,
		mem_used_mb INTEGER NOT NULL,
		mem_total_mb INTEGER NOT NULL,
		disk_percent REAL NOT NULL,
		disk_used_gb REAL NOT NULL,
		disk_total_gb REAL NOT NULL,
		uptime_hours REAL NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now'))
	); CREATE INDEX IF NOT EXISTS idx_metrics_created ON metrics(created_at DESC);`); err != nil {
		log.Fatal("migrate:", err)
	}

	go collectLoop()

	static, _ := frontend.ReadFile("frontend.html")
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(static)
	})
	mux.HandleFunc("/api/metrics/current", func(w http.ResponseWriter, r *http.Request) {
		serveJSON(w, getCurrent())
	})
	mux.HandleFunc("/api/metrics/history", func(w http.ResponseWriter, r *http.Request) {
		hours := 24
		switch r.URL.Query().Get("range") {
		case "7d": hours = 168
		case "30d": hours = 720
		}
		serveJSON(w, getHistory(hours))
	})

	addr := ":9090"
	log.Println("monitor listening on", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func collectLoop() {
	collect()
	for range time.Tick(60 * time.Second) {
		collect()
	}
}

func collect() {
	cpuPct, _ := cpu.Percent(0, false)
	v, _ := mem.VirtualMemory()
	d, _ := disk.Usage("/")

	var cpuP float64
	if len(cpuPct) > 0 {
		cpuP = cpuPct[0]
	}

	_, err := db.Exec(`INSERT INTO metrics (cpu_percent, mem_percent, mem_used_mb, mem_total_mb, disk_percent, disk_used_gb, disk_total_gb, uptime_hours) VALUES (?,?,?,?,?,?,?,?)`,
		round1(cpuP), round1(v.UsedPercent), v.Used/1024/1024, v.Total/1024/1024,
		round1(d.UsedPercent), round2(float64(d.Used)/1024/1024/1024), round2(float64(d.Total)/1024/1024/1024),
		round1(time.Since(startTime).Hours()),
	)
	if err != nil {
		log.Println("insert err:", err)
	}

	db.Exec(`DELETE FROM metrics WHERE created_at < datetime('now', '-90 days')`)
	// keep runtime GC happy
	runtime.GC()
}

func getCurrent() Metric {
	var m Metric
	row := db.QueryRow(`SELECT cpu_percent, mem_percent, mem_used_mb, mem_total_mb, disk_percent, disk_used_gb, disk_total_gb, uptime_hours, created_at FROM metrics ORDER BY id DESC LIMIT 1`)
	row.Scan(&m.CPUPercent, &m.MemPercent, &m.MemUsedMB, &m.MemTotalMB, &m.DiskPercent, &m.DiskUsedGB, &m.DiskTotalGB, &m.UptimeHours, &m.CreatedAt)
	return m
}

func getHistory(hours int) []Metric {
	cutoff := time.Now().Add(-time.Duration(hours) * time.Hour).UTC().Format(time.RFC3339)
	rows, _ := db.Query(`SELECT cpu_percent, mem_percent, disk_percent, created_at FROM metrics WHERE created_at >= ? ORDER BY id ASC`, cutoff)
	defer rows.Close()
	var out []Metric
	for rows.Next() {
		var m Metric
		rows.Scan(&m.CPUPercent, &m.MemPercent, &m.DiskPercent, &m.CreatedAt)
		out = append(out, m)
	}
	return out
}

func serveJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func round1(v float64) float64   { return float64(int(v*10)) / 10 }
func round2(v float64) float64   { return float64(int(v*100)) / 100 }
