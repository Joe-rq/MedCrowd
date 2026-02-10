#!/bin/bash
# Usage: ./update-submission.sh <demo-url>

set -e

DEMO_URL="${1:-$(cat .demo-url 2>/dev/null || echo '')}"

if [ -z "$DEMO_URL" ]; then
    echo "Usage: ./update-submission.sh <demo-url>"
    exit 1
fi

echo "Updating docs/SUBMISSION.md with Demo URL: $DEMO_URL"

sed -i '' "s/| Demo URL | \`.*\`/| Demo URL | \`$DEMO_URL\` |/" docs/SUBMISSION.md

echo "✅ docs/SUBMISSION.md updated"
echo ""
cat docs/SUBMISSION.md | grep -A2 "Demo URL"
