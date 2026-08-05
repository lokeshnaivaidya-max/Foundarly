#!/bin/bash

# Deploy Email Notification System to Supabase
# This script deploys the send-booking-email edge function

echo "🚀 Deploying Email Notification System..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if logged in
echo "📝 Checking Supabase login status..."
supabase projects list &> /dev/null
if [ $? -ne 0 ]; then
    echo "🔐 Please login to Supabase..."
    supabase login
fi

# Link project
echo "🔗 Linking to Supabase project..."
supabase link --project-ref tzihsuzxwziirpkvxysr

# Deploy function
echo "📤 Deploying send-booking-email function..."
supabase functions deploy send-booking-email --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Email function deployed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets"
    echo "2. Add these secrets:"
    echo "   - RESEND_API_KEY=re_gcnxwuHK_26dbVGZiLWyVoFkKdBeU5W9q"
    echo "   - SITE_URL=https://yourdomain.com"
    echo ""
    echo "3. Test by making a booking with payment"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Please check the error above."
    exit 1
fi
