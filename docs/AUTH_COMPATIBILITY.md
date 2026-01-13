# Authentication Compatibility Guide

## StoneScriptPHP Framework vs ngx-stonescriptphp-client

This document outlines the authentication flow compatibility between the Angular client library and StoneScriptPHP backend framework (v2.1.x).

**Document Status**: Updated for v1.1.2 (2025-12-26)

---

## ✅ FULLY COMPATIBLE (v1.0.0+)

**The authentication incompatibility issues documented below have been RESOLVED in v1.0.0 and later versions.**

For historical reference and migration guidance from pre-v1.0.0 versions, the original compatibility analysis is preserved below.

---

## Historical Reference: Pre-v1.0.0 Incompatibility (RESOLVED)

### Token Refresh Endpoint Mismatch

**CLIENT IMPLEMENTATION** (`api-connection.service.ts:187`):
```typescript
const refreshTokenUrl = this.host + 'user/refresh_access'
await fetch(refreshTokenUrl, {
    method: 'POST',
    body: JSON.stringify({
        access_token: this.accessToken,
        refresh_token: refreshToken
    })
})
```

**SERVER IMPLEMENTATION** (StoneScriptPHP `RefreshRoute.php`):
```php
// Default route: POST /auth/refresh
// OR custom: AuthRoutes::register($router, ['prefix' => '/api/auth']);

// Expected request:
// - Refresh token comes from httpOnly cookie (NOT request body)
// - CSRF token required in X-CSRF-Token header
// - Does NOT accept tokens in request body for security

// Response:
{
    "status": "ok",
    "data": {
        "access_token": "eyJ...",
        "expires_in": 900,
        "token_type": "Bearer"
    }
}
```

### Issues Identified

#### 1. **Endpoint Path Mismatch**
- **Client expects**: `/user/refresh_access`
- **Server provides**: `/auth/refresh` (default) or custom prefix

#### 2. **Token Transmission Mismatch**
- **Client sends**: Tokens in JSON request body
- **Server expects**:
  - Refresh token in httpOnly cookie (named `refresh_token`)
  - CSRF token in `X-CSRF-Token` header
  - **Does NOT read tokens from request body**

#### 3. **Security Model Mismatch**
- **Client**: Stores tokens in localStorage/sessionStorage (via TokenService)
- **Server**: Uses httpOnly cookies + CSRF protection (XSS-safe)

#### 4. **Response Format Mismatch**
- **Client expects**: `response.data.access_token`
- **Server returns**: `ApiResponse` where data is the second parameter:
  ```php
  return new ApiResponse('ok', [
      'access_token' => $token,
      'expires_in' => 900,
      'token_type' => 'Bearer'
  ]);
  ```

---

## Authentication Flow Analysis

### StoneScriptPHP Framework Auth System

The framework provides **two authentication modes**:

#### Mode 1: Built-in Cookie-Based Auth (Secure, Recommended)
Located in `/src/Auth/Routes/`:
- `POST /auth/refresh` - Refresh access token using httpOnly cookies
- `POST /auth/logout` - Logout and invalidate refresh token

**Security Features**:
- httpOnly cookies prevent XSS attacks
- CSRF token protection
- Refresh token rotation
- Optional token blacklisting via `TokenStorageInterface`

**Registration**:
```php
// In your index.php or bootstrap
use StoneScriptPHP\Auth\AuthRoutes;

AuthRoutes::register($router, [
    'prefix' => '/auth',  // or '/api/auth'
    'token_storage' => $tokenStorage  // optional
]);
```

#### Mode 2: Custom Implementation (Templates)
Located in `/src/Templates/Auth/`:
- `email-password/LoginRoute.php.template`
- `email-password/RegisterRoute.php.template`
- `email-password/PasswordResetRoute.php.template`
- `mobile-otp/SendOtpRoute.php.template`
- And more...

**Note**: Templates are **scaffolding code** that developers customize. They show:
- Example status values: `'success'` vs `'ok'` (inconsistent!)
- Example token format
- Database queries
- But are NOT the actual built-in implementation

---

## Current Client Implementation Analysis

### What Works ✅

1. **HTTP Methods**: All match (GET, POST, PUT, PATCH, DELETE)
2. **ApiResponse Structure**: Compatible
   - Client expects: `{ status: string, message: string, data: any }`
   - Server returns: Same structure
3. **Bearer Token Authentication**: Client correctly adds `Authorization: Bearer {token}`
4. **Automatic 401 Retry**: Client attempts token refresh on 401 errors

### What's Broken ❌

1. **Token Refresh Flow**: Completely incompatible
   - Different endpoint paths
   - Different token transmission method
   - Different security model

2. **AuthService**: Empty placeholder (no implementation)

3. **Login/Register Endpoints**: Not standardized
   - Templates show `/api/auth/login` but customizable
   - Response format varies (some templates use `'success'` vs `'ok'`)

---

## Compatibility Matrix

| Feature | Client (v0.0.13) | Framework (v2.1.x) | Compatible? |
|---------|------------------|-------------------|-------------|
| **HTTP Methods** | GET, POST, PUT, PATCH, DELETE | All supported | ✅ Yes |
| **ApiResponse Format** | `{status, message, data}` | Same | ✅ Yes |
| **Bearer Auth** | `Authorization: Bearer {token}` | Same | ✅ Yes |
| **Token Refresh Endpoint** | `/user/refresh_access` | `/auth/refresh` | ❌ No |
| **Token Storage** | localStorage | httpOnly cookies | ❌ No |
| **CSRF Protection** | Not implemented | Required | ❌ No |
| **Login Endpoint** | Not defined | Custom (templates) | ⚠️ Varies |
| **Token Format** | JWT in response body | JWT in cookie + body | ⚠️ Partial |

---

## Recommended Solutions

### Option 1: Update Client to Match Framework (Recommended)

**Pros**:
- Better security (httpOnly cookies)
- CSRF protection
- Aligns with framework best practices

**Cons**:
- Breaking change for existing users
- Requires cookie handling

**Implementation**:
1. Update `refreshAccessToken()` to:
   - Call `POST /auth/refresh` with credentials: 'include'
   - Send CSRF token from cookie
   - Don't send tokens in body
2. Add `CsrfService` to manage CSRF tokens
3. Update `TokenService` to work with cookies
4. Add cookie configuration to `MyEnvironmentModel`

### Option 2: Add Server-Side Compatibility Endpoint

**Pros**:
- No client breaking changes
- Backward compatible

**Cons**:
- Less secure (tokens in body)
- Developers must implement it

**Implementation**:
Create custom route in StoneScriptPHP project:
```php
// src/App/Routes/LegacyRefreshRoute.php
class LegacyRefreshRoute implements IRouteHandler {
    public function process(): ApiResponse {
        // Read tokens from request body
        $accessToken = request()->input['access_token'] ?? null;
        $refreshToken = request()->input['refresh_token'] ?? null;

        // Verify and refresh...
        // Return new access token
    }
}

// Register in routes.php
'POST' => [
    '/user/refresh_access' => LegacyRefreshRoute::class
]
```

### Option 3: Make Client Configurable

**Pros**:
- Supports both modes
- Migration path

**Cons**:
- More complex
- Maintenance burden

**Implementation**:
```typescript
export interface AuthConfig {
    mode: 'cookie' | 'body';
    refreshEndpoint: string;
    useCsrf: boolean;
}
```

---

## Migration Path for Existing Apps

For apps currently using the client with custom backends:

### Step 1: Check Your Backend Auth Implementation
```bash
# Does your backend match the client's expectations?
curl -X POST http://localhost:8000/user/refresh_access \
  -H "Content-Type: application/json" \
  -d '{"access_token": "...", "refresh_token": "..."}'
```

### Step 2: Update to StoneScriptPHP v2.1.x Auth
```php
// Option A: Use built-in secure auth
AuthRoutes::register($router, ['prefix' => '/api/auth']);

// Option B: Create legacy compatibility route
// See Option 2 above
```

### Step 3: Update Client Configuration
```typescript
// Wait for v0.0.14+ with auth config support
// OR implement custom auth service extending ApiConnectionService
```

---

## Action Items for Next Release (v0.0.14)

### Must Fix (Breaking Changes Acceptable):
1. ✅ Add configurable auth endpoints
2. ✅ Implement cookie-based auth mode
3. ✅ Add CSRF token support
4. ✅ Update AuthService with actual implementation
5. ✅ Document both auth modes

### Should Have:
1. Add login/register/logout helper methods
2. Add auth state management (RxJS)
3. Add auth guards/interceptors examples
4. Create migration guide with code examples

### Nice to Have:
1. Social auth helpers (Google, etc.)
2. Password reset flow helpers
3. Email verification helpers
4. Multi-factor auth support

---

## Conclusion

**Current Status**: ❌ **NOT FULLY COMPATIBLE**

The v0.0.13 client library is **compatible for general API calls** (CRUD operations) but **incompatible for authentication flows**.

### For Developers:
- ✅ Use for: CRUD API calls with manually managed auth
- ❌ Don't use: Built-in token refresh (broken)
- ⚠️ Workaround: Implement custom refresh logic or wait for v0.0.14

### For Package Maintainers:
- 🔴 **Priority**: Fix auth compatibility before promoting package
- 📝 Add clear warnings in README about auth limitations
- 🚀 Plan v0.0.14 with breaking changes to align with framework

---

## References

- **StoneScriptPHP Auth**: `/src/Auth/Routes/RefreshRoute.php`
- **Client Auth**: `/projects/ngx-stonescriptphp-client/src/lib/api-connection.service.ts`
- **Framework Version**: v2.1.x (on Packagist)
- **Client Version**: v0.0.13
