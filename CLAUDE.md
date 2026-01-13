# ngx-stonescriptphp-client - Developer Guide

> Internal documentation for AI developers and contributors working on the Angular client library.

## Project Overview

**ngx-stonescriptphp-client** is an Angular HTTP client library that enables type-safe API calls to StoneScriptPHP backends. It provides:

- **Type-safe HTTP methods** (GET, POST, PUT, PATCH, DELETE)
- **Automatic token management** with cookie/body auth modes
- **CSRF protection** for cookie-based sessions
- **Token refresh** with automatic retry on 401
- **Standardized error handling** with ApiResponse wrapper

## Architecture

### Core Services

| Service | Purpose |
|---------|---------|
| **ApiConnectionService** | HTTP client wrapper with auth & error handling |
| **TokenService** | Manages access/refresh tokens in localStorage |
| **CsrfService** | Handles CSRF token extraction from cookies |
| **SigninStatusService** | Auth state management (signedOut notifications) |
| **AuthService** | Stub service for extensibility |
| **DbService** | Stub service for offline storage integration |

### Request Flow

```
Component
  └─> ApiConnectionService.get/post/put/patch/delete()
        ├─> includeAccessToken() [if mode != 'none']
        ├─> fetch(url, options)
        ├─> 401 detected?
        │     └─> refreshAccessToken()
        │           ├─> cookie mode: POST /auth/refresh + CSRF header
        │           └─> body mode: POST /user/refresh_access + tokens
        │     └─> Retry with new token
        └─> return ApiResponse<DataType>
```

### Auth Modes

1. **cookie** (StoneScriptPHP v2.1.x default)
   - Token stored in httpOnly cookie by backend
   - Access token sent in Authorization header
   - CSRF token in X-CSRF-Token header
   - Credentials included in fetch

2. **body** (legacy/custom)
   - Tokens stored in localStorage
   - Sent in request body to refresh endpoint
   - No CSRF protection

3. **none** (manual auth)
   - No automatic token management
   - Use your own interceptors

## Key Implementation Details

### Token Storage

- **Access Token**: localStorage (`progalaxyapi_access_token`)
- **Refresh Token**: localStorage (`progalaxyapi_refresh_token`) - *not used in cookie mode*
- **CSRF Token**: Extracted from cookies as needed

### Cookie-based Auth Flow

```typescript
// 1. User logs in - backend sets httpOnly refresh_token cookie
// 2. Backend returns access_token in response.data.access_token

// 3. Subsequent requests:
//    - Include Authorization: Bearer {access_token}
//    - Include X-CSRF-Token header

// 4. On 401:
//    - POST /auth/refresh (with CSRF header)
//    - Cookies auto-sent by fetch (credentials: 'include')
//    - Get new access_token from response
//    - Retry original request
```

### ApiResponse Model

All responses wrapped in standard format:

```typescript
{
  status: 'ok' | 'error',
  data: DataType,
  message?: string
}
```

## File Structure

```
src/
├── api-connection.service.ts       # Main HTTP client (350 lines)
├── token.service.ts                # Token storage (65 lines)
├── csrf.service.ts                 # CSRF token extraction (44 lines)
├── auth.service.ts                 # Stub service
├── db.service.ts                   # Stub service
├── signin-status.service.ts         # Auth state
├── api-response.model.ts            # Response wrapper
├── my-environment.model.ts          # Config model
├── ngx-stonescriptphp-client.module.ts  # NgModule
├── index.ts                         # Public API
└── *.spec.ts                        # Test stubs
```

## Configuration

Module setup in `app.config.ts`:

```typescript
import { MyEnvironmentModel } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    NgxStoneScriptPhpClientModule.forRoot({
      apiServer: {
        host: 'http://localhost:9100/'  // Must have trailing slash
      },
      auth: {
        mode: 'cookie',  // or 'body' or 'none'
        refreshEndpoint: '/auth/refresh',
        useCsrf: true,
        csrfTokenCookieName: 'csrf_token'
      }
    } as MyEnvironmentModel)
  ]
}
```

## Common Issues & Solutions

### Issue: Token Not Refreshing

**Cause**: `refreshAccessToken()` called but endpoint returns wrong format

**Solution**:
- Verify response has `status: 'ok'`
- Access token in `data.access_token` or top-level `access_token`
- Include CSRF header if using cookie mode

### Issue: CORS Errors

**Cause**: Fetch requests cross-origin without proper headers

**Solution**:
- Set backend `Access-Control-Allow-Credentials: true`
- Verify `credentials: 'include'` in fetch options
- Check CORS headers for POST/PUT/PATCH

### Issue: CSRF Token Not Found

**Cause**: Cookie not set or httpOnly prevents access

**Solution**:
- Verify backend sets csrf_token cookie (not httpOnly)
- Use exact cookie name in config
- Log `document.cookie` to debug

## Testing

Run existing test stubs:

```bash
npm test
```

Tests are minimal - expand them based on usage patterns.

## Build & Publish

```bash
# Build library
npm run build

# Output in dist/ for consumption
# Publish to npm (public access)
npm run publish:npm
```

## Dependencies

**Peer**:
- `@angular/core` ^19.0.0 || ^20.0.0
- `@angular/common` ^19.0.0 || ^20.0.0

**Direct**:
- `tslib` ^2.8.0 (Angular library runtime)

**Dev**:
- `@angular/compiler-cli` ^20.0.0
- `ng-packagr` ^20.0.0
- `typescript` ~5.8.0

No RxJS dependency! This library uses Promises/fetch, not observables.

## Future Improvements

1. **RxJS Observable Wrapper** - Add observable versions of methods
2. **Interceptor Support** - Allow custom request/response interceptors
3. **File Upload** - Uncommented `postFormWithFiles` with proper error handling
4. **Retry Logic** - Exponential backoff for failed requests
5. **Offline Support** - DbService integration for queue/sync
6. **@stonescriptphp Namespace** - Migrate from @progalaxyelabs scope

## Related Documentation

- **Framework**: [stonescriptphp.org](https://stonescriptphp.org)
- **Main README**: See `README.md` for user guide
- **HLD**: See `HLD.md` for architecture overview
- **StoneScriptPHP Repo**: [github.com/progalaxyelabs/StoneScriptPHP](https://github.com/progalaxyelabs/StoneScriptPHP)

## Maintenance Notes

- Library is stable (v1.1.2)
- Active use in progalaxy-platform and other projects
- Updates published to npm public registry
- Check AUTH_COMPATIBILITY.md for backend compatibility matrix
