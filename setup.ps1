# GreenPulse — Setup Script
# Run this ONCE after creating Expo + GitHub accounts
# Usage: .\setup.ps1 -ExpoUsername "your_expo_username" -GitHubRepo "https://github.com/YOU/greenpulse.git"
#
# Prerequisites:
#   1. expo.dev account created
#   2. github.com/new → "greenpulse" repo created (Private)
#   3. Google Play Console account ($25 registration)

param(
    [Parameter(Mandatory=$true)]
    [string]$ExpoUsername,

    [Parameter(Mandatory=$true)]
    [string]$GitHubRepo
)

$ErrorActionPreference = "Stop"
$NODE = "$env:USERPROFILE\node"
$env:PATH = "$NODE;$env:PATH"

Write-Host "`n🌱 GreenPulse Setup" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green

# ── 1. EAS Login ──────────────────────────────────────────────────────────────
Write-Host "`n[1/6] Logging into Expo as '$ExpoUsername'..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\mobile"
eas login

# ── 2. EAS Init (creates projectId, updates app.json) ─────────────────────────
Write-Host "`n[2/6] Initializing EAS project..." -ForegroundColor Cyan
eas init --id
$appJson = Get-Content "app.json" | ConvertFrom-Json
$projectId = $appJson.expo.extra.eas.projectId
Write-Host "  ✓ Project ID: $projectId" -ForegroundColor Green

# ── 3. GitHub remote ──────────────────────────────────────────────────────────
Write-Host "`n[3/6] Setting up GitHub remote..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot"
git remote remove origin 2>$null
git remote add origin $GitHubRepo
Write-Host "  ✓ Remote set to $GitHubRepo" -ForegroundColor Green

# ── 4. Create placeholder assets if missing ───────────────────────────────────
Write-Host "`n[4/6] Checking assets..." -ForegroundColor Cyan
$assetsDir = "$PSScriptRoot\mobile\assets"
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null

$placeholderFiles = @("icon.png", "splash.png", "adaptive-icon.png", "notification-icon.png")
foreach ($f in $placeholderFiles) {
    $path = "$assetsDir\$f"
    if (-not (Test-Path $path)) {
        # Create a minimal 1x1 green PNG placeholder (will need real assets before publish)
        [System.IO.File]::WriteAllBytes($path, @(
            0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
            0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
            0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54,0x08,0xD7,0x63,0x18,0xD9,0x54,0x00,
            0x00,0x00,0x26,0x00,0x01,0xB3,0x88,0x9C,0xF7,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
            0x44,0xAE,0x42,0x60,0x82
        ))
        Write-Host "  ✓ Created placeholder: $f" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ Exists: $f" -ForegroundColor Green
    }
}

# Create empty google-services.json placeholder
$gsPath = "$PSScriptRoot\mobile\google-services.json"
if (-not (Test-Path $gsPath)) {
    '{"project_info":{"project_number":"","project_id":"greenpulse","storage_bucket":""},"client":[{"client_info":{"mobilesdk_app_id":"","android_client_info":{"package_name":"app.greenpulse.android"}},"api_key":[{"current_key":""}],"services":{"appinvite_service":{"other_platform_oauth_client":[]}}}],"configuration_version":"1"}' | Out-File $gsPath -Encoding utf8
    Write-Host "  ✓ Created placeholder google-services.json (replace with real one from Firebase)" -ForegroundColor Yellow
}

# ── 5. GitHub Secrets instructions ────────────────────────────────────────────
Write-Host "`n[5/6] GitHub Secrets needed:" -ForegroundColor Cyan
Write-Host "  Go to: $GitHubRepo/settings/secrets/actions" -ForegroundColor White
Write-Host ""
Write-Host "  Add these secrets:" -ForegroundColor White
Write-Host "  ┌─────────────────────────┬──────────────────────────────────────────┐" -ForegroundColor Gray
Write-Host "  │ Secret name             │ Where to get it                          │" -ForegroundColor Gray
Write-Host "  ├─────────────────────────┼──────────────────────────────────────────┤" -ForegroundColor Gray
Write-Host "  │ EXPO_TOKEN              │ expo.dev → Account Settings → Access Tokens │" -ForegroundColor White
Write-Host "  │ RAILWAY_TOKEN           │ railway.app → Account → Tokens           │" -ForegroundColor White
Write-Host "  │ GOOGLE_SERVICES_JSON    │ Firebase Console → Project Settings      │" -ForegroundColor White
Write-Host "  └─────────────────────────┴──────────────────────────────────────────┘" -ForegroundColor Gray

# ── 6. First push ─────────────────────────────────────────────────────────────
Write-Host "`n[6/6] Pushing to GitHub..." -ForegroundColor Cyan
git add -A
git commit -m "chore: eas init + setup assets" --allow-empty
git push -u origin master
Write-Host "  ✓ Pushed to $GitHubRepo" -ForegroundColor Green

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Add GitHub Secrets listed above"
Write-Host "  2. Replace mobile/assets/*.png with real GreenPulse icons (1024x1024 for icon.png)"
Write-Host "  3. Get google-services.json from Firebase Console and replace the placeholder"
Write-Host "  4. Add EAS secrets for env vars: eas secret:create --name SUPABASE_URL --value '...'"
Write-Host "  5. Trigger build: Actions tab → 'EAS Build & Submit Android' → Run workflow"
Write-Host ""
Write-Host "  Google Play Internal Testing URL (after first build):"
Write-Host "  https://play.google.com/console → Internal Testing → Create release"
