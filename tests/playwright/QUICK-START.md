# Playwright E2E Tests - Quick Start

## 3-Step Testing

### Step 1: Setup (One Time)

```bash
# From project root
./tests/setup-test.sh
```

### Step 2: Install Playwright

```bash
cd tests/playwright
npm install
npx playwright install
```

### Step 3: Run Tests

**Option A: Automatic** (recommended)

```bash
./run-e2e-tests.sh
```

Starts servers, runs tests, cleans up automatically.

**Option B: Manual**

```bash
# Terminal 1
node ../mock-accounts-server/server.js

# Terminal 2
cd ../angular-test-app && npm start

# Terminal 3
./test.sh
```

---

## Test Modes

| Command | What It Does |
|---------|--------------|
| `./test.sh` | Run all tests (headless) |
| `./test.sh --headed` | See browser while testing |
| `./test.sh --debug` | Step through tests |
| `./test.sh --ui` | Interactive mode |
| `./run-e2e-tests.sh --chrome-only` | Chrome only (faster) |

---

## View Results

```bash
npx playwright show-report
```

Opens HTML report with screenshots, videos, and traces.

---

## What's Tested

✅ **22 tests across 6 test suites:**

1. Email/Password Login (5 tests)
2. OAuth Authentication (3 tests)
3. Provider Configuration (4 tests)
4. Registration Flow (4 tests)
5. Session Persistence (2 tests)
6. UI/UX Validation (4 tests)

**Browsers:** Chromium, Firefox, WebKit

---

## Expected Results

```
Running 22 tests using 3 workers

  ✓ Email/Password › login successfully (3.2s)
  ✓ Email/Password › invalid credentials (2.1s)
  ✓ OAuth › Google popup (4.5s)
  ✓ Provider Config › email only (1.8s)
  ✓ Registration › existing email (2.3s)
  ...

  22 passed (45s)
```

---

## Debugging Failed Tests

```bash
# Run with browser visible
./test.sh --headed

# Step through test
./test.sh --debug

# View detailed report
npx playwright show-report

# Run specific test
npx playwright test -g "login successfully"
```

---

## File Structure

```
tests/playwright/
├── package.json           # Playwright dependency
├── playwright.config.ts   # Test configuration
├── tests/
│   └── auth.spec.ts       # All 22 tests
├── run-e2e-tests.sh       # Automatic runner
├── test.sh                # Manual runner
├── README.md              # Full documentation
└── QUICK-START.md         # This file
```

---

## Troubleshooting

### Servers not running

```bash
# Check mock server
curl http://localhost:8080/health

# Check Angular app
curl http://localhost:4200
```

### Playwright not installed

```bash
npm install
npx playwright install
```

### Port already in use

```bash
lsof -ti:8080 | xargs kill -9
lsof -ti:4200 | xargs kill -9
```

---

## Next Steps

1. **Run tests**: `./run-e2e-tests.sh`
2. **Fix any failures** using debug mode
3. **View report**: `npx playwright show-report`
4. **Add to CI/CD** (see README.md)

See [README.md](README.md) for full documentation.
