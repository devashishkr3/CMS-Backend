#!/bin/bash

# Quick Setup Script for GetEpay Payment Testing with ngrok
# This script sets up a public URL for your localhost backend

echo "🚀 GetEpay Payment Gateway - Quick Setup"
echo "========================================"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found. Installing..."
    # For macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install ngrok
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # For Linux, you'll need to download from ngrok.com
        echo "Please install ngrok from https://ngrok.com/download"
        exit 1
    fi
fi

echo "✅ ngrok is installed"
echo ""

# Kill any existing ngrok processes
echo "Cleaning up existing ngrok processes..."
killall ngrok 2>/dev/null || true
sleep 1

# Start ngrok in the background
echo "🌐 Starting ngrok tunnel to localhost:8080..."
ngrok http 8080 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get the ngrok URL
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL"
    kill $NGROK_PID
    exit 1
fi

echo "✅ ngrok URL: $NGROK_URL"
echo ""

# Update .env file
ENV_FILE="$(pwd)/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found in $(pwd)"
    kill $NGROK_PID
    exit 1
fi

echo "📝 Updating .env file..."

# Backup original .env
cp "$ENV_FILE" "$ENV_FILE.backup"

# Update GETEPAY_CALLBACK_URL
sed -i.bak "s|GETEPAY_CALLBACK_URL=.*|GETEPAY_CALLBACK_URL=${NGROK_URL}/api/v1/payments/callback|" "$ENV_FILE"

# Update GETEPAY_RETURN_URL (optional, for testing)
# sed -i.bak "s|GETEPAY_RETURN_URL=.*|GETEPAY_RETURN_URL=${NGROK_URL}/api/v1/payments/return|" "$ENV_FILE"

echo "✅ .env updated with ngrok URL"
echo ""

echo "📋 Updated Configuration:"
echo "========================"
echo "GETEPAY_CALLBACK_URL=${NGROK_URL}/api/v1/payments/callback"
echo ""

echo "🎯 Next Steps:"
echo "1. In a new terminal, restart your backend:"
echo "   cd /Users/manish/Downloads/Node_PG_GCM/Node\ js\ kit/Node\ Js\ PG\ Invoice/CMS-Backend"
echo "   npm run dev"
echo ""
echo "2. Keep this ngrok tunnel running"
echo ""
echo "3. Test your payment flow:"
echo "   - Create payment"
echo "   - Generate payment link"
echo "   - Complete payment on GetEpay"
echo "   - Watch backend logs for [CALLBACK] messages"
echo "   - Status should update to SUCCESS"
echo ""
echo "4. To stop ngrok, press Ctrl+C"
echo ""

# Wait for interrupt
trap "echo ''; echo '🛑 Stopping ngrok...'; kill $NGROK_PID; exit 0" INT
wait
