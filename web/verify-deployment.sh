#!/bin/bash
# MedCrowd Deployment Verification Script
# Usage: ./verify-deployment.sh <demo-url>

set -e

BASE_URL=${1:-"$(cat .demo-url 2>/dev/null || echo '')"} 

if [ -z "$BASE_URL" ]; then
    echo "Usage: ./verify-deployment.sh <demo-url>"
    echo "   or: echo 'https://your-project.vercel.app' > .demo-url"
    exit 1
fi

echo "🔍 Verifying MedCrowd deployment at: $BASE_URL"
echo "=============================================="

PASS=0
FAIL=0

# Helper function
check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"

    echo -n "  Checking $name... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "$expected_status" ]; then
        echo "✅ $status"
        ((PASS++))
        return 0
    else
        echo "❌ $status (expected $expected_status)"
        ((FAIL++))
        return 1
    fi
}

# Core API checks
echo ""
echo "1️⃣ Core API Endpoints"
check_endpoint "Session API" "$BASE_URL/api/auth/session"
check_endpoint "Login Page" "$BASE_URL/api/auth/login"
check_endpoint "Logout Page" "$BASE_URL/api/auth/logout"
check_endpoint "Triage API" "$BASE_URL/api/act/triage" "405"

# Page checks
echo ""
echo "2️⃣ Page Accessibility"
check_endpoint "Landing Page" "$BASE_URL/"
check_endpoint "Ask Page" "$BASE_URL/ask"

echo ""
echo "=============================================="
echo "📊 Results: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then
    echo "⚠️  Some checks failed - review above"
    exit 1
fi

echo ""
echo "🎉 Basic deployment verification PASSED!"
echo ""
echo "Next steps for full verification:"
echo "  1. Complete OAuth login flow in browser"
echo "  2. Submit a test health question"
echo "  3. Verify consultation completes with 'DONE' status"
echo "  4. Check report and share pages render correctly"
echo "  5. Test cold-start persistence (wait for function timeout, then refresh)"

exit 0
