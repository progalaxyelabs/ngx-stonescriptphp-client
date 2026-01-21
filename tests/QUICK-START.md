# Quick Start - Testing in 3 Steps

## First Time Setup

```bash
./tests/setup-test.sh
```

This will:
- Build the library (`dist/`)
- Create Angular test app (`tests/angular-test-app/`)
- Install dependencies
- Configure everything automatically

**Time:** ~2-3 minutes

---

## Running Tests

```bash
./tests/run-test.sh
```

This starts:
- Mock accounts server on `http://localhost:8080`
- Angular test app on `http://localhost:4200`

**Open:** [http://localhost:4200](http://localhost:4200)

---

## Testing

### Test Credentials
- **Email:** `test@example.com`
- **Password:** `Test@123`

### What to Click

| Button | What It Tests |
|--------|---------------|
| **Google + Email** | Shows email form + Google OAuth button |
| **Email Only** | Shows only email/password form |
| **All Providers** | Shows all 6 authentication options |
| **Register** | Opens registration form |
| **No Providers** | Error handling (should throw error) |

### Expected Results

1. **Click "Email Only"**
   - Enter: `test@example.com` / `Test@123`
   - Should show "Test User" after login
   - User object displays on page

2. **Click "Google + Email" then Google button**
   - Popup opens
   - Shows "Google" with spinner
   - Auto-closes after 1 second
   - User "google User" appears

3. **Click "Register"**
   - Fill in form with new email
   - Success message shows
   - Try `test@example.com` → "Email already registered"

4. **After login, click "Sign Out"**
   - User object disappears
   - Can login again

---

## Manual Commands

### Just the Mock Server
```bash
node tests/mock-accounts-server/server.js
```

### Just the Test App
```bash
cd tests/angular-test-app
npm start
```

### Rebuild Library
```bash
npm run build
cd tests/angular-test-app
npm install ../../dist --legacy-peer-deps
```

---

## Checking Results

### Browser Console
```javascript
// Check token
localStorage.getItem('progalaxyapi_access_token')

// Check cookies
document.cookie
```

### DevTools → Network Tab
- Look for POST to `/api/auth/login`
- Check response: `status: 'ok'`
- Verify cookies set

### Mock Server Terminal
```
✓ Login: test@example.com
✓ OAuth: google
✓ Token refreshed
✓ Logout
```

---

## Troubleshooting

### "ng: command not found"
```bash
npm install -g @angular/cli
```

### Port already in use
```bash
# Kill process on port 4200
lsof -ti:4200 | xargs kill -9

# Kill process on port 8080
lsof -ti:8080 | xargs kill -9
```

### Library changes not showing
```bash
npm run build
cd tests/angular-test-app
npm install ../../dist --legacy-peer-deps
```

### CORS errors
- Restart mock server
- Ensure using `localhost` not `127.0.0.1`

---

## Done Testing?

Press `Ctrl+C` in the terminal running `run-test.sh`

This stops both the mock server and Angular app.

---

## Next: Publishing

After successful testing:

1. Update version in `package.json` to `2.0.0`
2. Run `npm run publish:npm`
3. Update platforms to use new version

See [tests/README.md](README.md) for detailed testing guide.
