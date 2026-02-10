#!/bin/bash
# MedCrowd Deployment Script - Task 5 Checkpoint
# Usage: ./deploy-checkpoint.sh <vercel-token>

set -e

TOKEN=${1:-$VERCEL_TOKEN}
if [ -z "$TOKEN" ]; then
    echo "Error: Vercel token required. Pass as argument or set VERCEL_TOKEN"
    exit 1
fi

echo "🚀 Deploying MedCrowd to Vercel..."

# Ensure KV environment variables are set
if [ -z "$KV_REST_API_URL" ] || [ -z "$KV_REST_API_TOKEN" ]; then
    echo "⚠️  KV credentials missing - will use JSON fallback mode"
fi

cd web

# Deploy with token
vercel --prod --token="$TOKEN" --yes

echo "✅ Deployment complete!"
echo "📝 Update docs/SUBMISSION.md with the returned URL"
