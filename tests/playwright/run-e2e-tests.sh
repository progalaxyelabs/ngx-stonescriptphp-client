#!/bin/bash
# Run E2E Tests for ngx-stonescriptphp-client
#
# This script:
# 1. Starts mock accounts server
# 2. Starts Angular test app
# 3. Runs Playwright tests
# 4. Cleans up

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}ngx-stonescriptphp-client E2E Tests${NC}"
echo -e "${BLUE}================================${NC}\n"

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
    echo -e "${YELLOW}⚠ Playwright not installed${NC}"
    echo -e "${BLUE}Installing Playwright...${NC}"
    npm install
    npx playwright install
fi

# Start mock server in background
echo -e "${GREEN}[1/4]${NC} Starting mock accounts server..."
cd ../mock-accounts-server
node server.js &
MOCK_PID=$!
cd ../playwright

# Wait for mock server to start
sleep 2

# Check if mock server is running
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo -e "${RED}✗ Mock server failed to start${NC}"
    kill $MOCK_PID 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}✓${NC} Mock server running on port 8080"

# Start Angular test app in background
echo -e "\n${GREEN}[2/4]${NC} Starting Angular test app..."
cd ../angular-test-app

# Check if test app exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}✗ Angular test app not found${NC}"
    echo -e "${YELLOW}Please run ./tests/setup-test.sh first${NC}"
    kill $MOCK_PID 2>/dev/null || true
    exit 1
fi

npm start > /dev/null 2>&1 &
NG_PID=$!
cd ../playwright

# Wait for Angular app to start (can take 10-20 seconds)
echo -e "${BLUE}Waiting for Angular app to start...${NC}"
MAX_WAIT=60
COUNTER=0
while ! curl -s http://localhost:4200 > /dev/null; do
    if [ $COUNTER -ge $MAX_WAIT ]; then
        echo -e "${RED}✗ Angular app failed to start within ${MAX_WAIT}s${NC}"
        kill $MOCK_PID $NG_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
    echo -ne "${BLUE}.${NC}"
done
echo -e "\n${GREEN}✓${NC} Angular app running on port 4200"

# Run Playwright tests
echo -e "\n${GREEN}[3/4]${NC} Running Playwright tests..."
echo -e "${BLUE}================================${NC}\n"

# Determine which browsers to test
if [ "$1" == "--headed" ]; then
    npx playwright test --headed
elif [ "$1" == "--debug" ]; then
    npx playwright test --debug
elif [ "$1" == "--ui" ]; then
    npx playwright test --ui
elif [ "$1" == "--chrome-only" ]; then
    npx playwright test --project=chromium
else
    npx playwright test
fi

TEST_EXIT_CODE=$?

# Cleanup
echo -e "\n${GREEN}[4/4]${NC} Cleaning up..."
kill $MOCK_PID $NG_PID 2>/dev/null || true
sleep 1

# Show results
echo -e "\n${BLUE}================================${NC}"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo -e "${BLUE}View report: npx playwright show-report${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo -e "${BLUE}View report: npx playwright show-report${NC}"
    echo -e "${BLUE}Debug: ./run-e2e-tests.sh --debug${NC}"
fi
echo -e "${BLUE}================================${NC}\n"

exit $TEST_EXIT_CODE
