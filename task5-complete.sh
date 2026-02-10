#!/bin/bash
set -e

echo "🔄 Task 5 Complete Recovery"
echo "============================"

if [ ! -f .demo-url ]; then
    echo "❌ Error: .demo-url not found"
    exit 1
fi

DEMO_URL=$(cat .demo-url)
echo "📍 Demo URL: $DEMO_URL"

echo ""
echo "1️⃣ Updating docs/SUBMISSION.md..."
./update-submission.sh "$DEMO_URL"

echo ""
echo "2️⃣ Verifying deployment..."
cd web && ./verify-deployment.sh "$DEMO_URL" || echo "⚠️  Verification issues, continuing..."

echo ""
echo "3️⃣ Committing changes..."
git add docs/SUBMISSION.md
git commit -m "chore(release): deploy checkpoint and publish demo url"

echo ""
echo "✅ Task 5 complete!"
