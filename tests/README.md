# Testing ngx-stonescriptphp-client

Complete testing setup with mock accounts server, Angular test app, and automated E2E tests.

## Quick Start

### Manual Testing

```bash
# One-time setup
./tests/setup-test.sh

# Run servers
./tests/run-test.sh
```

Open [http://localhost:4200](http://localhost:4200) and test authentication flows manually.

### Automated E2E Testing (Playwright)

```bash
# One-time setup (if not done above)
./tests/setup-test.sh

# Install Playwright
cd tests/playwright
npm install && npx playwright install

# Run automated tests
./run-e2e-tests.sh
```

**22 automated tests** covering all authentication flows. See [playwright/QUICK-START.md](playwright/QUICK-START.md).

## Test Credentials

- **Email:** `test@example.com`
- **Password:** `Test@123`

## What Gets Tested

### 1. Email/Password Login
- Click "Email Only" button
- Enter test credentials
- Should see user object after successful login

### 2. OAuth Providers
- Click "Google + Email" or "All Providers"
- Click any OAuth button (Google, LinkedIn, etc.)
- Popup window opens with mock OAuth flow
- Auto-closes after 1 second with mock user data

### 3. Registration
- Click "Register" button
- Fill in form fields
- Test validation (passwords must match)
- Try registering with test@example.com (should fail - already exists)
- Try new email (should succeed)

### 4. Error Handling
- Click "No Providers (Error Test)"
- Should throw error in console
- Demonstrates required providers validation

### 5. Session Management
- After login, user object displays
- Click "Sign Out" to clear session
- Session persists across page reloads (check with F5)

## Manual Testing

### Start Mock Server Only

```bash
node tests/mock-accounts-server/server.js
```

Visit [http://localhost:8080/health](http://localhost:8080/health) to see available endpoints.

### Start Test App Only

```bash
cd tests/angular-test-app
npm start
```

## Test Endpoints

The mock server provides:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/register` | POST | User registration |
| `/api/auth/session` | GET | Check current session |
| `/api/auth/logout` | POST | Sign out |
| `/auth/refresh` | POST | Refresh access token |
| `/oauth/:provider` | GET | OAuth flow (google, linkedin, apple, microsoft, github) |

## Testing Checklist

### Email/Password Login
- [ ] Valid credentials login successfully
- [ ] Invalid credentials show error
- [ ] Loading state displays during login
- [ ] Error message shows for wrong password
- [ ] User object appears after login
- [ ] Access token stored in localStorage
- [ ] Cookies set correctly (check DevTools → Application → Cookies)

### OAuth Login
- [ ] Google button opens popup
- [ ] LinkedIn button opens popup
- [ ] Apple button opens popup
- [ ] Microsoft button opens popup
- [ ] GitHub button opens popup
- [ ] Popup shows loading spinner
- [ ] Popup closes automatically after 1s
- [ ] User object appears after OAuth success
- [ ] postMessage communication works

### Registration
- [ ] Form validation works (required fields)
- [ ] Password mismatch shows error
- [ ] Existing email shows "already registered" error
- [ ] New email registration succeeds
- [ ] Success message displays
- [ ] "Already have an account?" link exists

### Provider Configuration
- [ ] "Google + Email" shows 2 options
- [ ] "Email Only" shows only email form
- [ ] "All Providers" shows 6 options (5 OAuth + email)
- [ ] Divider appears between email and OAuth when both present
- [ ] No divider when only one type shown
- [ ] "No Providers" throws error with helpful message

### Session & Token Management
- [ ] Session persists after page reload
- [ ] Sign out clears user state
- [ ] Sign out clears cookies
- [ ] CSRF token sent in refresh requests
- [ ] Token refresh works on 401 errors
- [ ] Access token updated after refresh

### UI/UX
- [ ] Dialog width is 400px
- [ ] Loading overlay shows during async operations
- [ ] Error messages styled correctly
- [ ] OAuth buttons have provider-specific classes
- [ ] Register link works from login
- [ ] Login link works from register (if implemented)
- [ ] Responsive design works on mobile viewport

## Debugging

### Check Browser Console

```javascript
// Check stored tokens
localStorage.getItem('progalaxyapi_access_token')

// Check cookies
document.cookie

// Check AuthService state
// (In component: inject AuthService and log)
console.log(authService.getCurrentUser())
console.log(authService.isAuthenticated())
```

### Check Network Tab

1. Open DevTools → Network
2. Test login
3. Verify:
   - POST to `/api/auth/login` has correct body
   - Response has `status: 'ok'`
   - Cookies set in response headers
   - CSRF token in request headers (for refresh)

### Mock Server Logs

The mock server logs all requests:

```
✓ Login: test@example.com
✗ Login failed: wrong@email.com
✓ Token refreshed
✓ OAuth: google
✓ Logout
```

## Troubleshooting

### Issue: Angular CLI not found
```bash
npm install -g @angular/cli
```

### Issue: Port 4200 already in use
```bash
# Kill existing process
lsof -ti:4200 | xargs kill -9

# Or use different port
cd tests/angular-test-app
ng serve --port 4201
```

### Issue: Port 8080 already in use
```bash
# Kill existing process
lsof -ti:8080 | xargs kill -9

# Or edit server.js to use different port
```

### Issue: CORS errors
- Ensure mock server is running on `http://localhost:8080`
- Ensure Angular app is running on `http://localhost:4200`
- Check browser console for specific CORS error

### Issue: Cookies not set
- Check DevTools → Application → Cookies
- Ensure `credentials: 'include'` in fetch (handled by library)
- Verify CORS headers allow credentials

### Issue: OAuth popup blocked
- Check browser popup blocker settings
- Allow popups for `localhost:4200`

### Issue: Library changes not reflected
```bash
# Rebuild and reinstall
npm run build
cd tests/angular-test-app
npm install ../../dist --legacy-peer-deps
```

## Advanced Testing

### Test Token Refresh

1. Login successfully
2. Wait 15 minutes (or manually expire token in mock server)
3. Make API call
4. Should automatically refresh token and retry
5. Check Network tab for `/auth/refresh` call

### Test CSRF Protection

1. Login successfully
2. Open DevTools → Application → Cookies
3. Delete `csrf_token` cookie
4. Try to make API call
5. Should fail with 403 Forbidden

### Test Session Persistence

1. Login successfully
2. Refresh page (F5)
3. User should still be authenticated
4. Check if `checkSession()` was called on app init

## Test Coverage

Current test scenarios:

- ✅ Email/password authentication
- ✅ OAuth authentication (all 5 providers)
- ✅ User registration
- ✅ Session management
- ✅ Token refresh
- ✅ CSRF protection
- ✅ Error handling
- ✅ Provider configuration validation
- ✅ Loading states
- ✅ Cookie-based auth
- ✅ Popup-based OAuth flow

Not yet tested (future):

- ⏳ Body-based auth mode
- ⏳ Token expiry edge cases
- ⏳ Network failure scenarios
- ⏳ Concurrent refresh requests
- ⏳ Password reset flow
- ⏳ Email verification

## Next Steps

After testing:

1. **Fix any bugs found**
2. **Update version to 2.0.0** in `package.json`
3. **Create CHANGELOG.md** with v2.0.0 notes
4. **Publish to npm**: `npm run publish:npm`
5. **Update platforms** to use v2.0.0
6. **Add unit tests** for components and services

## Files Structure

```
tests/
├── README.md                    # This file
├── setup-test.sh                # One-time setup script
├── run-test.sh                  # Start test environment
├── mock-accounts-server/
│   └── server.js                # Mock API server (180 lines, no deps)
└── angular-test-app/            # Generated by setup script
    ├── src/
    │   ├── app/
    │   │   ├── test-auth.component.ts
    │   │   ├── app.config.ts
    │   │   └── app.routes.ts
    │   └── environments/
    │       └── environment.ts
    └── package.json
```
