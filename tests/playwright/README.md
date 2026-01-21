# Playwright E2E Tests

Automated end-to-end testing for ngx-stonescriptphp-client authentication flows using Playwright.

## Quick Start

### Option 1: Automatic (Recommended)

Runs everything automatically - starts servers, runs tests, cleans up:

```bash
cd tests/playwright
./run-e2e-tests.sh
```

### Option 2: Manual

Start servers manually, then run tests:

```bash
# Terminal 1: Mock server
node tests/mock-accounts-server/server.js

# Terminal 2: Angular app
cd tests/angular-test-app && npm start

# Terminal 3: Tests
cd tests/playwright
./test.sh
```

## Test Modes

### Headless (Default)
```bash
./test.sh
```
Runs all tests in headless mode across all browsers (Chromium, Firefox, WebKit).

### Headed (Visible Browser)
```bash
./test.sh --headed
```
See the browser while tests run.

### Debug Mode
```bash
./test.sh --debug
```
Step through tests with Playwright Inspector.

### UI Mode (Interactive)
```bash
./test.sh --ui
```
Interactive test runner with time-travel debugging.

### Chrome Only (Fast)
```bash
./run-e2e-tests.sh --chrome-only
```
Test only in Chromium (faster for development).

## What Gets Tested

### ✅ Email/Password Authentication
- Display test page with all buttons
- Show test credentials
- Login successfully with valid credentials
- Show error for invalid credentials
- Sign out successfully

### ✅ OAuth Authentication
- Open OAuth popup for Google
- Close popup automatically after 1 second
- Authenticate with mock OAuth user
- Show all OAuth providers in "All Providers" dialog
- Test LinkedIn OAuth flow

### ✅ Provider Configuration
- Show only email form for "Email Only"
- Show email + Google for "Google + Email"
- Show all 6 providers for "All Providers"
- Throw error for "No Providers"

### ✅ Registration Flow
- Open registration dialog
- Show error for existing email
- Show error for password mismatch
- Register successfully with new email

### ✅ Session Persistence
- Persist session after page reload
- Clear session after logout

### ✅ UI/UX Validation
- Show loading state during login
- Proper dialog width (400px)
- Show "Sign up" link in login dialog
- Show "Sign in" link in register dialog

## Test File Structure

```typescript
tests/
└── auth.spec.ts          # All authentication tests

Test Suites:
- Email/Password Authentication (5 tests)
- OAuth Authentication (3 tests)
- Provider Configuration (4 tests)
- Registration Flow (4 tests)
- Session Persistence (2 tests)
- UI/UX Validation (4 tests)

Total: 22 tests
```

## Prerequisites

### 1. Setup Test Environment

Run the setup script if you haven't already:

```bash
cd ../..  # Back to project root
./tests/setup-test.sh
```

This creates:
- Angular test app
- Mock accounts server
- All necessary configurations

### 2. Install Playwright

```bash
cd tests/playwright
npm install
npx playwright install
```

## Viewing Test Results

### HTML Report

After tests run, view the report:

```bash
npx playwright show-report
```

Opens interactive report with:
- Test results
- Screenshots of failures
- Video recordings (on failure)
- Trace files for debugging

### Console Output

Tests display results in terminal:

```
Running 22 tests using 3 workers

  ✓ Email/Password Authentication › should login successfully
  ✓ OAuth Authentication › should open OAuth popup for Google
  ✓ Provider Configuration › should show only email form
  ...

  22 passed (45s)
```

## Debugging Failed Tests

### 1. Run in Debug Mode

```bash
./test.sh --debug
```

Playwright Inspector opens, allowing you to:
- Step through each test action
- Inspect DOM at each step
- View screenshots
- Check network requests

### 2. View Trace

If test failed, view trace in report:

```bash
npx playwright show-report
```

Click on failed test → "Trace" tab to see:
- Timeline of actions
- Screenshots at each step
- Network activity
- Console logs

### 3. Run Specific Test

```bash
npx playwright test -g "should login successfully"
```

Runs only tests matching the pattern.

### 4. Update Snapshots

If visual tests fail due to expected changes:

```bash
npx playwright test --update-snapshots
```

## Writing New Tests

### Test Template

```typescript
test('should do something', async ({ page }) => {
  // Navigate to page
  await page.goto('/');

  // Interact with elements
  await page.getByRole('button', { name: 'Click Me' }).click();

  // Assert results
  await expect(page.locator('.result')).toContainText('Success');
});
```

### Common Patterns

#### Open Login Dialog
```typescript
await page.getByRole('button', { name: 'Email Only' }).click();
await expect(page.locator('.login-dialog')).toBeVisible();
```

#### Fill Login Form
```typescript
await page.locator('input[name="email"]').fill('test@example.com');
await page.locator('input[name="password"]').fill('Test@123');
await page.getByRole('button', { name: 'Sign in' }).click();
```

#### Handle OAuth Popup
```typescript
const popupPromise = context.waitForEvent('page');
await page.locator('button.btn-google').click();
const popup = await popupPromise;
await popup.waitForLoadState();
```

#### Wait for Dialog to Close
```typescript
await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 10000 });
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Setup test environment
        run: ./tests/setup-test.sh

      - name: Run E2E tests
        run: cd tests/playwright && ./run-e2e-tests.sh

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: tests/playwright/playwright-report/
```

## Configuration

### Browsers

Edit `playwright.config.ts` to change which browsers to test:

```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },  // Disabled
  // { name: 'webkit', use: { ...devices['Desktop Safari'] } },     // Disabled
]
```

### Timeouts

Adjust timeouts in `playwright.config.ts`:

```typescript
timeout: 30000,        // Max test time (30s)
expect: {
  timeout: 5000        // Assertion timeout (5s)
}
```

### Screenshots & Videos

Configure capture settings:

```typescript
use: {
  screenshot: 'only-on-failure',   // or 'on', 'off'
  video: 'retain-on-failure',       // or 'on', 'off', 'retry-with-video'
  trace: 'on-first-retry',          // or 'on', 'off', 'retain-on-failure'
}
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Kill process on port 4200
lsof -ti:4200 | xargs kill -9
```

### Playwright Browsers Not Installed

```bash
npx playwright install
```

### Tests Timing Out

Increase timeout in `playwright.config.ts`:

```typescript
timeout: 60000  // 60 seconds
```

### Angular App Not Starting

```bash
cd ../angular-test-app
npm install
npm start
```

### Mock Server Not Responding

Check server logs:

```bash
node ../mock-accounts-server/server.js
# Should show: 🚀 Mock Accounts Server
```

### CORS Errors

Ensure:
- Mock server on `localhost:8080` (not `127.0.0.1`)
- Angular app on `localhost:4200` (not `127.0.0.1`)

## Performance

### Parallel Execution

Tests run in parallel by default (3 workers):

```bash
# Single worker (slower, easier to debug)
npx playwright test --workers=1

# Max workers
npx playwright test --workers=100%
```

### Test Duration

Expected times (on average hardware):

- Single test: ~2-5 seconds
- Full suite (22 tests): ~45-60 seconds
- Full suite (3 browsers): ~2-3 minutes

## Best Practices

1. **Use data-testid for stable selectors**
   ```html
   <button data-testid="login-button">Login</button>
   ```
   ```typescript
   await page.getByTestId('login-button').click();
   ```

2. **Wait for network idle**
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

3. **Use auto-waiting**
   Playwright auto-waits for elements to be actionable.

4. **Group related tests**
   ```typescript
   test.describe('Feature Name', () => {
     test.beforeEach(async ({ page }) => {
       // Setup
     });

     test('scenario 1', async ({ page }) => { });
     test('scenario 2', async ({ page }) => { });
   });
   ```

5. **Clean up state**
   ```typescript
   test.afterEach(async ({ page }) => {
     // Logout, clear cookies, etc.
   });
   ```

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Test Assertions](https://playwright.dev/docs/test-assertions)

## Next Steps

After successful E2E testing:

1. Add more test scenarios (edge cases, error handling)
2. Set up CI/CD pipeline with GitHub Actions
3. Add visual regression testing
4. Test on mobile viewports
5. Add performance testing
