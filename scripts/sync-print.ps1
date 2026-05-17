param(
    [string]$Server = "http://47.116.137.143:8080",
    [string]$Email = "test@test.com",
    [string]$Password = "123456",
    [string]$OutputDir = "D:\print_images"
)

$ErrorActionPreference = "Stop"

Write-Host ("[{0}] Login..." -f (Get-Date -Format HH:mm:ss))
$body = @{email=$Email;password=$Password} | ConvertTo-Json
$res = Invoke-RestMethod -Uri "$Server/api/v1/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $res.data.access_token
Write-Host "  OK (uid=$($res.data.user.id))"

Write-Host ("[{0}] Fetching all public images..." -f (Get-Date -Format HH:mm:ss))
$allImages = @()
$page = 1
$limit = 100

do {
    $url = "$Server/api/v1/public/images?limit=$limit&page=$page"
    $res = Invoke-RestMethod -Uri $url -Method GET
    $items = $res.data.items
    $total = $res.data.total
    $allImages += $items
    $page++
} while ($allImages.Count -lt $total)

Write-Host "  Found: $total"

$added = 0
$kept = @{}

foreach ($img in $allImages) {
    $name = $img.filename
    $kept[$name] = $true
    $out = Join-Path $OutputDir $name

    if (Test-Path $out) {
        if ((Get-Item $out).Length -eq $img.file_size) { continue }
    }

    Write-Host ("  Download: {0} ({1} bytes)" -f $name, $img.file_size)
    Invoke-WebRequest -Uri $img.url -OutFile $out
    $added++
}

Write-Host ("  Downloaded: {0}" -f $added)

Write-Host ("[{0}] Cleanup..." -f (Get-Date -Format HH:mm:ss))
$removed = 0
if (Test-Path $OutputDir) {
    Get-ChildItem $OutputDir -File | ForEach-Object {
        if (-not $kept[$_.Name]) {
            Write-Host ("  Remove: {0}" -f $_.Name)
            Remove-Item $_.FullName -Force
            $removed++
        }
    }
}
Write-Host ("  Removed: {0}" -f $removed)
Write-Host ("[{0}] Done. Added={1} Removed={2} Kept={3}" -f (Get-Date -Format HH:mm:ss), $added, $removed, $kept.Count)
