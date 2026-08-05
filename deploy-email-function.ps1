# Deploy Email Notification System to Supabase (PowerShell)
# This script deploys the send-booking-email edge function

Write-Host "🚀 Deploying Email Notification System..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "❌ Supabase CLI not found. Installing..." -ForegroundColor Red
    npm install -g supabase
}

# Check if logged in
Write-Host "📝 Checking Supabase login status..." -ForegroundColor Yellow
$loginCheck = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔐 Please login to Supabase..." -ForegroundColor Yellow
    supabase login
}

# Link project
Write-Host "🔗 Linking to Supabase project..." -ForegroundColor Yellow
supabase link --project-ref tzihsuzxwziirpkvxysr

# Deploy function
Write-Host "📤 Deploying send-booking-email function..." -ForegroundColor Yellow
supabase functions deploy send-booking-email --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Email function deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets"
    Write-Host "2. Add these secrets:"
    Write-Host "   - RESEND_API_KEY=re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q"
    Write-Host "   - SITE_URL=https://yourdomain.com"
    Write-Host ""
    Write-Host "3. Test by making a booking with payment"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Please check the error above." -ForegroundColor Red
    exit 1
}
