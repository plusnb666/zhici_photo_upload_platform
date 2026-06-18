param(
    [string]$Server = "http://47.116.137.143:8080",
    [string]$TagName = "",
    [string]$OutputDir = "D:\print_images"
)

$ErrorActionPreference = "Stop"

# Tag name - encode Chinese or ASCII
$encTag = [uri]::EscapeDataString($TagName)
$tagDisplay = $TagName

Write-Host ("[{0}] Fetching images with tag [{1}]..." -f (Get-Date -Format "HH:mm:ss"), $tagDisplay)

$all = @()
$page = 1
$limit = 100

do {
    $url = "$Server/api/v1/public/images?limit=$limit&page=$page&tag=$encTag"
    $res = Invoke-RestMethod -Uri $url -Method GET

    $items = if ($res.data.items) { $res.data.items } else { @() }
    $all += $items
    $total = $res.data.total
    $page++
} while ($all.Count -lt $total)

Write-Host ("  Found: {0}" -f $total)

if ($total -eq 0) {
    Write-Host ("  No images with tag [{0}], exit." -f $tagDisplay)
    exit 0
}

# Summary per uploader
$userStats = @{}
$totalBytes = 0L
foreach ($img in $all) {
    $u = if ($img.username) { $img.username } else { "unknown" }
    if (-not $userStats.ContainsKey($u)) { $userStats[$u] = @{count=0;bytes=0} }
    $userStats[$u].count++
    $sz = if ($img.file_size) { $img.file_size } else { 0 }
    $userStats[$u].bytes += $sz
    $totalBytes += $sz
}

function Fmt($b) {
    if ($b -ge 1048576) { return "{0:N1} MB" -f ($b/1048576) }
    if ($b -ge 1024)    { return "{0:N1} KB" -f ($b/1024) }
    return "$b B"
}

# Ensure output dir
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null }

$out = Join-Path $OutputDir "print_summary.txt"
$lines = @()

$lines += "=============================================="
$lines += ("Print Summary - " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
$lines += ("Tag: " + $tagDisplay)
$lines += "=============================================="
$lines += ("Total: {0} images, {1}" -f $all.Count, (Fmt $totalBytes))
$lines += ""

$lines += "--- Image List ---"
$lines += ""
$n = 1
foreach ($img in $all) {
    $uploader = if ($img.username) { $img.username } else { "unknown" }
    $lines += ("{0}. {1}  ({2})  by: {3}" -f $n, $img.filename, (Fmt $img.file_size), $uploader)
    $n++
}

$lines += ""
$lines += "--- By Uploader ---"
$lines += ""
$userStats.GetEnumerator() | Sort-Object { $_.Value.count } -Descending | ForEach-Object {
    $lines += ("  {0}: {1} images, {2}" -f $_.Key, $_.Value.count, (Fmt $_.Value.bytes))
}

$lines += ""
$lines += "=============================================="
$lines += ("Total: {0} images, {1}" -f $all.Count, (Fmt $totalBytes))

$lines | Out-File -FilePath $out -Encoding UTF8
Write-Host ("[{0}] Output: {1}" -f (Get-Date -Format "HH:mm:ss"), $out)
Write-Host ""
$lines | ForEach-Object { Write-Host $_ }
