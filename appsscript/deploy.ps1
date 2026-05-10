# deploy.ps1 — safe deploy: push code + create new versioned deployment
# Access is always ANYONE_ANONYMOUS (endpoint open, but Auth.gs restricts to whitelist)
# Usage: cd appsscript && powershell -ExecutionPolicy Bypass -File .\deploy.ps1 "description"
#
# After each run, update frontend/config.js with the new URL printed at the end.
# OR keep reusing the same deployment: set $ReuseDeployId to an existing ID to update it.

param([string]$Description = "deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')")

$ScriptId    = "1DQP0vkxH6iwjJkpvahJzjkE7FNDtE8RxHxpIjDsJcHeEodM0J5MnY9Sk"
$ClaspRcPath = "$env:USERPROFILE\.clasprc.json"
$BaseUrl     = "https://script.googleapis.com/v1/projects/$ScriptId"

# ── 1. Refresh access token ───────────────────────────────────────────────────
Write-Host "[1/4] Refreshing access token..." -ForegroundColor Cyan
$rc     = (Get-Content $ClaspRcPath -Raw | ConvertFrom-Json).tokens.default
$tokRes = Invoke-RestMethod -Method POST `
    -Uri "https://oauth2.googleapis.com/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "client_id=$($rc.client_id)&client_secret=$($rc.client_secret)&refresh_token=$($rc.refresh_token)&grant_type=refresh_token"
$token = $tokRes.access_token
if (-not $token) { Write-Error "Token refresh failed"; exit 1 }
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
Write-Host "    Token OK" -ForegroundColor Green

# ── 2. Push code ──────────────────────────────────────────────────────────────
Write-Host "[2/4] Pushing code..." -ForegroundColor Cyan
$pushDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $pushDir
clasp push --force
if ($LASTEXITCODE -ne 0) { Write-Error "clasp push failed"; Pop-Location; exit 1 }
Pop-Location
Write-Host "    Code pushed" -ForegroundColor Green

# ── 3. Create new version ─────────────────────────────────────────────────────
Write-Host "[3/4] Creating new version..." -ForegroundColor Cyan
$verBody = @{ description = $Description } | ConvertTo-Json
$verRes  = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/versions" -Headers $headers -Body $verBody
$versionNumber = $verRes.versionNumber
Write-Host "    Version $versionNumber created" -ForegroundColor Green

# ── 4. Create deployment with ANYONE_ANONYMOUS access ────────────────────────
Write-Host "[4/4] Creating deployment (access = Anyone, no sign-in)..." -ForegroundColor Cyan
$depBody = @{
    versionNumber    = $versionNumber
    manifestFileName = "appsscript"
    description      = $Description
} | ConvertTo-Json

$dep = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/deployments" -Headers $headers -Body $depBody

$newUrl = $dep.entryPoints[0].webApp.url
$newId  = $dep.deploymentId

Write-Host ""
Write-Host "Deployed version $versionNumber" -ForegroundColor Green
Write-Host "Access: $($dep.entryPoints[0].webApp.entryPointConfig.access)" -ForegroundColor Green
Write-Host ""
Write-Host "ACTION REQUIRED: update frontend/config.js with new URL:" -ForegroundColor Yellow
Write-Host "  const API_URL = '$newUrl';" -ForegroundColor White
Write-Host ""
Write-Host "Deployment ID: $newId" -ForegroundColor Gray
