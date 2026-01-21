#!/bin/bash
# Quick Test Runner (assumes servers already running)
#
# Usage:
#   ./test.sh              # Run all tests
#   ./test.sh --headed     # Run with browser visible
#   ./test.sh --debug      # Debug mode
#   ./test.sh --ui         # Interactive UI mode

cd "$(dirname "$0")"

# Check if servers are running
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ Mock server not running on port 8080"
    echo "   Start it with: node ../mock-accounts-server/server.js"
    exit 1
fi

if ! curl -s http://localhost:4200 > /dev/null; then
    echo "❌ Angular app not running on port 4200"
    echo "   Start it with: cd ../angular-test-app && npm start"
    exit 1
fi

echo "✓ Mock server running"
echo "✓ Angular app running"
echo ""

# Install Playwright if needed
if [ ! -d "node_modules/@playwright" ]; then
    echo "Installing Playwright..."
    npm install
    npx playwright install
    echo ""
fi

# Run tests
npx playwright test "$@"
