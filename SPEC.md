# ngx-stonescriptphp-client — Library Specification

**Status:** Prescriptive specification — defines the contract code MUST follow.
**Scope:** Open-source Angular library for authenticating users and making type-safe API calls to StoneScriptPHP and progalaxyelabs-auth backends.
**Package:** `@progalaxyelabs/ngx-stonescriptphp-client`

Where current code does not match this spec, an "Implementation gap" note is included.

---

## 1. What the Library Supports

### 1.1 Authentication Flows

The library supports two authentication flows:

- **Email OTP** — The user enters an email address (or phone number). A 6-digit one-time PIN is sent. The user enters the PIN in six individual digit boxes. On success, the library receives a `verified_token` and exchanges it for JWT access/refresh tokens.
- **OAuth popup** — The user clicks a provider button (Google, GitHub, LinkedIn, Apple, Microsoft, Zoho, or a custom provider). A popup opens for the OAuth flow. On completion, the library receives JWT tokens.

Password-based login is supported for backward compatibility with StoneScriptPHP backends but is not the primary flow. The default auth plugin (progalaxyelabs-auth) does not use passwords.

### 1.2 What the Library Provides

| Capability | Provided |
|------------|----------|
| Auth plugin interface for extensibility | Yes |
| Two built-in auth plugins | Yes |
| JWT token storage and automatic refresh | Yes |
| HTTP client with automatic Bearer token injection | Yes |
| File upload/download service | Yes |
| Login/register UI components (OTP, OAuth, tenant selection) | Yes |
| Reactive auth state (`user$` observable) | Yes |
| Multi-tenant support (tenant selection, onboarding checks) | Yes |
| Multi-server auth support | Yes |
| Route guards (`authGuard`, `loginGuard`, `subscriptionGuard`) | Yes — see §7 |

### 1.3 What the Library Does NOT Provide

| Capability | Not provided |
|------------|--------------|
| Routing or route definitions | Consuming app responsibility |
| Dashboard, settings, or data table pages | Consuming app responsibility |
| Onboarding wizard | Consuming app responsibility |
| Subscription management UI | Consuming app responsibility |
| Offline storage / IndexedDB | Not implemented |

---

## 2. Auth Plugin Interface

### 2.1 Contract

Any auth plugin MUST implement the `AuthPlugin` interface and be provided via the `AUTH_PLUGIN` injection token.

```typescript
export const AUTH_PLUGIN = new InjectionToken<AuthPlugin>('AUTH_PLUGIN');

export interface AuthPlugin {
    // ── Required ──────────────────────────────────────────────────────
    login(email: string, password: string): Promise<AuthResult>;
    register(email: string, password: string, displayName: string): Promise<AuthResult>;
    logout(refreshToken?: string): Promise<void>;
    checkSession(): Promise<AuthResult>;
    refresh(accessToken: string, refreshToken?: string): Promise<string | null>;

    // ── Optional: OAuth ───────────────────────────────────────────────
    loginWithProvider?(provider: string): Promise<AuthResult>;

    // ── Optional: OTP ─────────────────────────────────────────────────
    sendOtp?(identifier: string): Promise<OtpSendResponse>;
    verifyOtp?(identifier: string, code: string): Promise<OtpVerifyResponse>;
    identityLogin?(verifiedToken: string): Promise<AuthResult>;
    identityRegister?(verifiedToken: string, displayName: string): Promise<AuthResult>;

    // ── Optional: Multi-tenant ────────────────────────────────────────
    selectTenant?(tenantId: string, accessToken: string): Promise<AuthResult>;
    getTenantMemberships?(accessToken: string): Promise<TenantMembership[]>;
    checkTenantSlugAvailable?(slug: string): Promise<{ available: boolean; suggestion?: string }>;
    checkOnboardingStatus?(identityId: string, platformCode?: string): Promise<any>;
    checkEmail?(email: string): Promise<{ exists: boolean; user?: any }>;

    // ── Optional: Multi-server ────────────────────────────────────────
    switchServer?(serverName: string): void;
    getAvailableServers?(): string[];
    getActiveServer?(): string | null;
    getServerConfig?(serverName?: string): any;
}
```

### 2.2 Writing a Custom Auth Plugin

To write a compatible auth plugin:

1. Create a class that implements `AuthPlugin`.
2. Implement all five required methods.
3. Implement optional methods only for features your backend supports.
4. Return `AuthResult` from login/register/session methods — the library reads `success`, `accessToken`, `refreshToken`, and `user` from this object.
5. The `refresh()` method MUST return a new access token string on success, or `null` on failure. The library calls this method automatically on 401 responses.
6. The `logout()` method MUST clear any server-side session state. The library handles clearing client-side tokens and user state separately.

### 2.3 Providing a Custom Plugin

```typescript
provideNgxStoneScriptPhpClient(environment, new MyCustomAuthPlugin(/* deps */))
```

If no plugin is provided, the library defaults to `StoneScriptPHPAuth`.

### 2.4 AuthResult Contract

Every auth operation that returns `AuthResult` MUST populate these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `success` | Yes | `true` if the operation succeeded |
| `message` | On failure | Human-readable error message |
| `accessToken` | On success | JWT access token |
| `refreshToken` | On success (body mode) | JWT refresh token (cookie mode may omit) |
| `user` | On success | User object with at minimum `email` and `display_name` |
| `needsVerification` | Optional | `true` if email verification is pending |
| `membership` | Optional | Active tenant membership after tenant selection |
| `memberships` | Optional | List of available tenant memberships for selection |
| `isNewIdentity` | Optional | `true` if this login created a new identity |

### 2.5 OTP Response Contracts

**OtpSendResponse:**

| Field | Required | Description |
|-------|----------|-------------|
| `success` | Yes | Whether the OTP was sent |
| `identifier_type` | Yes | `'email'` or `'phone'` |
| `masked_identifier` | Yes | e.g., `s***@example.com` |
| `expires_in` | Yes | Seconds until OTP expires |
| `resend_after` | Yes | Seconds before resend is allowed |

**OtpVerifyResponse:**

| Field | Required | Description |
|-------|----------|-------------|
| `success` | Yes | Whether verification succeeded |
| `verified_token` | On success | Opaque token to exchange for JWT via `identityLogin` or `identityRegister` |
| `error` | On failure | One of: `'otp_expired'`, `'otp_invalid'`, `'otp_rate_limited'`, `'otp_not_found'` |
| `remaining_attempts` | Optional | Attempts left before lockout |
| `can_resend` | Optional | Whether the user can request a new code |
| `retry_after` | Optional | Seconds before retry is allowed |

---

## 3. Token Storage and Access Levels

### 3.1 Storage Location

All tokens are stored in `localStorage` under fixed keys:

| Key | Content |
|-----|---------|
| `progalaxyapi_access_token` | JWT access token |
| `progalaxyapi_refresh_token` | JWT refresh token |
| `progalaxyapi_user` | Serialized `User` object (JSON) |
| `progalaxyapi_active_auth_server` | Active auth server name (multi-server mode) |

### 3.2 Access Levels

**Accessible to auth plugins:**

| What | How |
|------|-----|
| Current access token | Received as parameter in `refresh(accessToken, refreshToken?)` |
| Current refresh token | Received as parameter in `refresh()` and `logout(refreshToken?)` |
| Token setting | Plugins return tokens in `AuthResult`; the library stores them |

Auth plugins MUST NOT read or write `localStorage` directly for token management. The library mediates all token storage.

**Accessible to the consuming Angular app:**

| What | How |
|------|-----|
| Read access token | `TokenService.getAccessToken()` |
| Read refresh token | `TokenService.getRefreshToken()` |
| Check token validity | `TokenService.hasValidAccessToken()` (presence check, not expiry) |
| Decode JWT claims | `TokenService.decodeJwtPayload(token?)` |
| Auth state | `AuthService.isAuthenticated()`, `AuthService.getCurrentUser()`, `AuthService.user$` |
| Sign-in status | `SigninStatusService.status` (BehaviorSubject) |

The consuming app SHOULD use `AuthService` for auth operations rather than calling `TokenService` directly.

**Internal to the library only:**

| What | How |
|------|-----|
| Setting tokens from auth results | `TokenService.setTokens()`, `setAccessToken()`, `setRefreshToken()` |
| Clearing tokens on logout | `TokenService.clear()` |
| User persistence to localStorage | `AuthService` manages `progalaxyapi_user` |
| Automatic Bearer header injection | `ApiConnectionService.includeAccessToken()` |
| Automatic 401 refresh-and-retry | `ApiConnectionService` internal flow |

> **Implementation gap:** `TokenService.setTokens()`, `setAccessToken()`, `setRefreshToken()`, and `clear()` are currently public. They SHOULD be restricted so that only the library's internal services can call them. Consuming apps should go through `AuthService` for all auth state changes.

### 3.3 JWT Decoding

`TokenService.decodeJwtPayload()` performs base64url decoding of the JWT payload without signature verification. This is intentional — signature verification is the backend's responsibility. The method is provided so consuming apps can read claims (e.g., `tenant_id`, `role`, `exp`) for UI decisions such as route guarding.

---

## 4. Identity State Transitions

### 4.1 States

An identity (user account) exists in one of these states:

| State | Description |
|-------|-------------|
| **pending** | Identity created but email not verified |
| **active** | Email verified, fully functional |
| **suspended** | Administratively disabled; cannot authenticate |
| **deleted** | Marked for deletion or permanently removed |

### 4.2 Transitions

```
                  ┌──────────┐
     register ──> │ pending  │
                  └────┬─────┘
                       │ verify email
                       v
                  ┌──────────┐
                  │  active  │ <── reactivate (admin)
                  └──┬───┬───┘
                     │   │
          suspend    │   │  delete request
          (admin)    │   │
                     v   v
              ┌──────────┐  ┌─────────┐
              │suspended │  │ deleted  │
              └──────────┘  └─────────┘
```

### 4.3 Library Behavior Per State

| State | Login attempt | Token refresh | API calls |
|-------|--------------|---------------|-----------|
| **pending** | Succeeds; `AuthResult.needsVerification = true` | Succeeds | Backend may restrict; library does not enforce |
| **active** | Succeeds | Succeeds | Normal |
| **suspended** | Fails with error message from backend | Fails; library calls `signedOut()` | Existing tokens may work until expiry; refresh fails |
| **deleted** | Fails with error message from backend | Fails; library calls `signedOut()` | Fails |

### 4.4 Client-Side Auth State Machine

From the library's perspective, the user is in one of two states:

```
┌──────────────┐          login/register success           ┌─────────────┐
│ signed-out   │ ─────────────────────────────────────────> │  signed-in  │
│              │ <───────────────────────────────────────── │             │
└──────────────┘   logout / refresh failure / manual clear  └─────────────┘
```

- **signed-out:** `SigninStatusService.status` emits `false`. No Bearer token is attached to requests.
- **signed-in:** `SigninStatusService.status` emits `true`. Bearer token is automatically attached.

Transition to signed-out happens when:
1. `AuthService.signout()` is called explicitly.
2. A 401 response is received AND the token refresh also fails (double-401).
3. `TokenService.clear()` is called (internal).

---

## 5. API Client Integration

### 5.1 ApiConnectionService Interface

`ApiConnectionService` is the sole HTTP client for making API calls to the backend. All methods return `Promise<ApiResponse<T>>`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get<T>` | `(endpoint, queryParams?) => Promise<ApiResponse<T>>` | GET request with optional query parameters object |
| `post<T>` | `(pathWithQuery, data) => Promise<ApiResponse<T>>` | POST with JSON body |
| `put<T>` | `(pathWithQuery, data) => Promise<ApiResponse<T>>` | PUT with JSON body |
| `patch<T>` | `(pathWithQuery, data) => Promise<ApiResponse<T>>` | PATCH with JSON body |
| `delete<T>` | `(endpoint, queryParams?) => Promise<ApiResponse<T>>` | DELETE with optional query parameters |
| `refreshAccessToken` | `() => Promise<boolean>` | Trigger manual token refresh |
| `buildQueryString` | `(options?) => string` | Build query string from object |

### 5.2 Request Pipeline

Every request follows this pipeline:

1. **URL construction:** `environment.apiServer.host` + endpoint path.
2. **Token injection:** If a valid access token exists, attach `Authorization: Bearer {token}` header.
3. **CSRF injection (cookie mode):** If `auth.useCsrf` is true, read CSRF token from cookie and attach as `X-CSRF-Token` header.
4. **Fetch execution:** Native `fetch()` with `mode: 'cors'`, `redirect: 'error'`. Cookie mode requests include `credentials: 'include'`.
5. **401 handling:** If response is 401 and a token was sent, attempt one automatic refresh-and-retry cycle. If retry also returns 401, emit `signedOut()`.
6. **Response wrapping:** Parse JSON response into `ApiResponse<T>`.

### 5.3 ApiResponse Contract

All API responses are wrapped in `ApiResponse<T>`:

```typescript
class ApiResponse<T> {
    status: string;       // 'ok' | 'not ok' | 'error'
    data: T | null;
    message: string;

    get success(): boolean;  // status === 'ok'
    get errors(): string[];

    // Chainable callbacks
    onOk(callback: (data: T) => void): ApiResponse<T>;
    onNotOk(callback: (message: string) => void): ApiResponse<T>;
    onError(callback: (message: string) => void): ApiResponse<T>;

    // Accessor methods
    isSuccess(): boolean;
    isError(): boolean;
    getData(): T | null;
    getError(): string;
    getMessage(): string;
    getStatus(): string;
}
```

The consuming app SHOULD use the chainable pattern:

```typescript
const response = await this.api.get<Widget[]>('/widgets');
response
  .onOk(widgets => this.widgets = widgets)
  .onNotOk(msg => this.error = msg)
  .onError(msg => this.error = msg);
```

### 5.4 FilesService

`FilesService` provides file upload and download operations against a dedicated files server (or the API server if no files server is configured).

| Method | Description |
|--------|-------------|
| `upload(file, folder?)` | Upload a single file |
| `uploadMultiple(files, folder?)` | Upload multiple files |
| `download(fileId)` | Download a file by ID |
| `list(folder?)` | List files in a folder |
| `delete(fileId)` | Delete a file |

`FilesService` implements its own token injection and 401 refresh-and-retry logic, mirroring `ApiConnectionService`.

> **Implementation gap:** `FilesService` duplicates the refresh-and-retry logic from `ApiConnectionService`. This SHOULD be extracted into a shared internal utility.

---

## 6. Raw Fetch Restrictions

### 6.1 Rule

Consuming Angular applications MUST NOT make direct `fetch()`, `XMLHttpRequest`, or `HttpClient` calls to the API server. All API communication MUST go through `ApiConnectionService` (or `FilesService` for file operations).

### 6.2 Rationale

Direct API calls bypass:
- Automatic Bearer token injection
- Automatic 401 refresh-and-retry
- CSRF token attachment
- Consistent error handling via `ApiResponse<T>`
- Sign-out detection on authentication failure

### 6.3 Enforcement

Projects using this library SHOULD configure ESLint rules to catch raw API calls:

```javascript
// .eslintrc.js (recommended rules)
module.exports = {
  rules: {
    'no-restricted-globals': ['error', {
      name: 'fetch',
      message: 'Use ApiConnectionService instead of raw fetch(). Import from @progalaxyelabs/ngx-stonescriptphp-client.'
    }],
    'no-restricted-properties': ['error', {
      object: 'window',
      property: 'fetch',
      message: 'Use ApiConnectionService instead of window.fetch().'
    }],
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@angular/common/http',
        message: 'Do not use HttpClient. Use ApiConnectionService from @progalaxyelabs/ngx-stonescriptphp-client.'
      }]
    }]
  }
};
```

> **Implementation gap:** The library does not currently ship these lint rules or an ESLint plugin. Projects must configure them manually.

> **Implementation gap:** The library itself uses raw `fetch()` internally (by design), but consuming apps should not. A shared ESLint config or schematic should be provided to enforce this automatically.

---

## 7. Route Guards

### 7.1 Library-Provided Guards

The library provides the following route guards as injectable `CanActivateFn`s (exported from the package root). Consuming apps import and apply them to their route definitions, and configure redirect targets via the 3rd argument of `provideNgxStoneScriptPhpClient` (§7.2).

> **authGuard also performs the AUTH-SPEC exchange-before-API step:** when the stored token is still an identity JWT, it exchanges it for a platform token (detected by `token_type === 'platform'`) before allowing the route to load. An already-exchanged platform token is **never** re-exchanged.

#### authGuard

Protects routes that require authentication.

| Condition | Action |
|-----------|--------|
| Not authenticated | Redirect to app's login route |
| Authenticated, no tenant selected (JWT `tenant_id` is absent or `'none'`) and URL is not an onboarding path | Redirect to app's onboarding route |
| Authenticated, no tenant, URL is onboarding path | Allow |
| Authenticated with tenant | Allow |

#### loginGuard

Prevents authenticated users from seeing the login page.

| Condition | Action |
|-----------|--------|
| Authenticated with tenant | Redirect to app's dashboard route |
| Authenticated without tenant | Allow (login page handles tenant selection) |
| Not authenticated | Allow |

#### subscriptionGuard

Protects routes that require an active subscription.

| Condition | Action |
|-----------|--------|
| URL is an onboarding path | Allow (no subscription check) |
| `GET /subscription/status` succeeds | Allow |
| `GET /subscription/status` returns 4xx | Redirect to app's subscription error route |
| Network error or 5xx | Allow (fail-open) |

### 7.2 Guard Configuration

Because consuming apps define their own routes, guards MUST accept configuration for redirect targets:

```typescript
provideNgxStoneScriptPhpClient(environment, plugin, {
  routes: {
    login: '/login',                    // where authGuard redirects unauthenticated users
    dashboard: '/admin/dashboard',      // where loginGuard redirects authenticated users
    onboarding: '/admin/onboarding',    // onboarding path prefix (bypass authGuard tenant check)
    subscriptionError: '/subscription-error'  // where subscriptionGuard redirects on 4xx
  }
});
```

### 7.3 Custom Guards

Consuming apps may create additional guards using the library's services:

```typescript
export const myCustomGuard: CanActivateFn = (route, state) => {
    const tokenService = inject(TokenService);
    const claims = tokenService.decodeJwtPayload();
    // Custom logic using JWT claims
    return claims?.role === 'admin';
};
```

> **Status:** The guards described above are provided by the library as of v2.4.0 (`authGuard`, `loginGuard`, `subscriptionGuard`, exported from the package root, configured via `NGX_GUARD_CONFIG` / the 3rd arg of `provideNgxStoneScriptPhpClient`). Consuming apps should adopt these rather than hand-rolling per-platform guards.

---

## 8. Configurability

### 8.1 Setup

The library is configured via `provideNgxStoneScriptPhpClient()`:

```typescript
import { provideNgxStoneScriptPhpClient, MyEnvironmentModel } from '@progalaxyelabs/ngx-stonescriptphp-client';

const env: MyEnvironmentModel = { /* ... */ };
const providers = provideNgxStoneScriptPhpClient(env);
// or with custom plugin:
const providers = provideNgxStoneScriptPhpClient(env, customPlugin);
```

### 8.2 Configurable by Consuming App

| Setting | Type | Required | Default | Description |
|---------|------|----------|---------|-------------|
| `apiServer.host` | `string` | Yes | — | API server URL (trailing slash recommended) |
| `production` | `boolean` | No | `true` | Production mode flag |
| `debug` | `boolean` | No | `false` | Enable `[DEBUG]` console logs |
| `platformCode` | `string` | No | `''` | Platform identifier for multi-tenant auth |
| `filesServer.host` | `string` | No | `apiServer.host` | Dedicated file server URL |
| `chatServer.host` | `string` | No | — | WebSocket chat server URL |
| `auth.mode` | `'cookie' \| 'body' \| 'none'` | No | `'cookie'` | Token transport mode |
| `auth.host` | `string` | No | `apiServer.host` | Auth server URL if separate from API |
| `auth.refreshEndpoint` | `string` | No | `'/auth/refresh'` | Token refresh endpoint path |
| `auth.useCsrf` | `boolean` | No | `true` | Enable CSRF token handling |
| `auth.csrfTokenCookieName` | `string` | No | `'csrf_token'` | CSRF cookie name |
| `auth.csrfHeaderName` | `string` | No | `'X-CSRF-Token'` | CSRF header name |
| `auth.refreshTokenCookieName` | `string` | No | `'refresh_token'` | Refresh token cookie name |
| `auth.responseMap` | `AuthResponseMap` | No | See below | Map backend response fields to expected structure |
| `authServers` | `Record<string, AuthServerConfig>` | No | — | Multi-server auth configuration |
| `customProviders` | `Record<string, OAuthProviderConfig>` | No | — | Custom OAuth provider display config |
| `branding.appName` | `string` | No | — | App name shown in auth UI |
| `branding.logo` | `string` | No | — | Logo URL for auth UI |
| `branding.primaryColor` | `string` | No | — | Primary theme color |
| `branding.gradientStart` | `string` | No | — | Gradient start color |
| `branding.gradientEnd` | `string` | No | — | Gradient end color |
| `branding.subtitle` | `string` | No | — | Subtitle shown in auth UI |

### 8.3 AuthResponseMap (Custom Response Formats)

For backends that return non-standard response shapes:

```typescript
interface AuthResponseMap {
    successPath?: string;       // default: 'status'
    successValue?: string;      // default: 'ok'
    accessTokenPath: string;    // default: 'data.access_token'
    refreshTokenPath: string;   // default: 'data.refresh_token'
    userPath: string;           // default: 'data.user'
    errorMessagePath?: string;  // default: 'message'
}
```

### 8.4 Fixed by the Library (Not Configurable)

| Behavior | Fixed value | Rationale |
|----------|-------------|-----------|
| Token storage mechanism | `localStorage` | Consistent cross-tab access; no IndexedDB |
| Token storage keys | `progalaxyapi_*` prefix | Avoid collisions; consistent across platforms |
| HTTP client | Native `fetch()` | No Angular `HttpClient` dependency; promise-based |
| 401 retry strategy | Single automatic retry after refresh | Prevents infinite retry loops |
| Response wrapper | `ApiResponse<T>` | Standardized error handling contract |
| JWT decoding | Base64url decode without signature verification | Signature verification is backend responsibility |
| CORS mode | `mode: 'cors'`, `redirect: 'error'` | Security defaults |

---

## 9. Default Auth Plugin: progalaxyelabs-auth

### 9.1 Overview

The `ProgalaxyElabsAuth` plugin connects to the Rust/Axum auth server at `auth.progalaxyelabs.com`. It uses body-mode tokens (no cookies) and the server's native response format.

### 9.2 Auth Flows

#### OTP Login (Primary)

1. User enters email address in the identifier input field.
2. UI shows a hint below the input: "We'll send a verification code to this email."
3. User clicks "Continue". Library calls `sendOtp(email)`.
4. If the identifier is unknown, the input shows an orange banner: "No account found. Please register first." (not a hard error — the user can still proceed to register).
5. On success, UI transitions to OTP entry: six individual digit input boxes.
6. Auto-advance: entering a digit focuses the next box. Backspace focuses the previous box.
7. Paste support: pasting a 6-digit code fills all boxes and auto-submits.
8. A countdown timer shows seconds remaining. When expired, a "Resend code" link appears.
9. On submit, library calls `verifyOtp(email, code)`.
10. On success, library receives a `verified_token` and calls `identityLogin(verifiedToken)`.
11. If the identity is new (`isNewIdentity: true`), a registration form appears asking for display name, then calls `identityRegister(verifiedToken, displayName)`.

**Fallback:** An "I already have an OTP" link is always visible, allowing users to skip the send step and go directly to the 6-digit entry.

#### OTP Error Messages

| Error code | User-facing message |
|------------|---------------------|
| `otp_invalid` | "Invalid code. N attempt(s) remaining." |
| `otp_expired` | "Your code has expired. Please request a new one." |
| `otp_rate_limited` | "Too many attempts. Please try again later." |
| `otp_not_found` | "No code found. Please request a new one." |

Error severity is communicated visually: orange banners for recoverable issues, red banners for blocking errors.

#### Google OAuth Login

1. User clicks the Google sign-in button.
2. Plugin calls `loginWithProvider('google')`.
3. A popup window opens for OAuth consent.
4. On callback, the plugin receives tokens in the native format: `{ access_token, refresh_token, identity, membership }`.
5. The library stores tokens and sets auth state.

Other OAuth providers (GitHub, LinkedIn, Apple, Microsoft, Zoho) follow the same pattern.

### 9.3 Tenant Selection

After authentication, if the user has multiple tenant memberships:

1. The library calls `getTenantMemberships()`.
2. UI shows a list of tenant cards, each displaying: tenant name, user's role, last accessed time.
3. If only one membership exists and `autoSelectSingleTenant` is enabled, it is selected automatically.
4. On selection, library calls `selectTenant(tenantId)`. The backend issues new tokens scoped to that tenant.

### 9.4 Organisation Creation

New users (or users without a tenant) can create an organisation:

1. A warning box explains what creating an organisation means.
2. User enters the organisation (tenant) name.
3. A URL slug is auto-generated from the name and checked for availability in real-time.
4. User submits, and the tenant is created.

### 9.5 No Passwords

The progalaxyelabs-auth plugin uses OTP and OAuth exclusively. There are no password fields, no "forgot password" links, and no password strength indicators in the default auth UI. Password-based login is only available when using the `StoneScriptPHPAuth` plugin with a StoneScriptPHP backend that supports it.

### 9.6 Server Details

| Property | Value |
|----------|-------|
| Server | Rust/Axum at `auth.progalaxyelabs.com` |
| JWT algorithm | RS256 (RSA 2048-bit) |
| Access token TTL | 15 minutes |
| Refresh token TTL | 180 days |
| Token transport | Body mode (tokens in response body, not cookies) |
| Response format | Flat JSON: `{ access_token, refresh_token, identity, membership }` |
| OTP expiry | 5 minutes (300 seconds) |
| OTP max attempts | 3 |
| OTP rate limit | 1 request per 60 seconds |
| Database | PostgreSQL via StoneScriptDB Gateway |

### 9.7 Component Inputs

The `<lib-tenant-login>` component accepts these inputs for customization:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `providers` | `string[]` | `['google']` | OAuth provider buttons to display |
| `otpIdentifierTypes` | `string[]` | `['email']` | Identifier types accepted (`'email'`, `'phone'`) |
| `showTenantSelector` | `boolean` | `true` | Show tenant selection after login |
| `autoSelectSingleTenant` | `boolean` | `true` | Auto-select if only one membership |
| `title` | `string` | `'Sign In'` | Login form title |

---

---

## 10. verify-OTP Contract

### 10.1 Input

The `verifyOtp()` method accepts:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `identifier` | `string` | Yes | Email or phone that received the OTP |
| `code` | `string` | Yes | 6-digit OTP code entered by user |

### 10.2 Expected Server Response

The progalaxyelabs-auth server returns (see progalaxyelabs-auth SPEC.md §4):

**Success (HTTP 200):**
```json
{
    "success": true,
    "verified_token": "eyJ..."
}
```

**Failure (HTTP 400/404):**
```json
{
    "success": false,
    "error": "otp_invalid",
    "message": "Invalid verification code",
    "remaining_attempts": 2
}
```

Error codes: `otp_invalid`, `otp_expired`, `otp_rate_limited`, `otp_not_found`.

### 10.3 Library Interpretation

The library returns `OtpVerifyResponse`:

```typescript
interface OtpVerifyResponse {
    success: boolean;
    verified_token: string;       // Empty on failure
    error?: string;               // Error code on failure
    message?: string;             // Human-readable message
    remaining_attempts?: number;  // Attempts left before lockout
    can_resend?: boolean;
    retry_after?: number;
}
```

**Success detection:** `success === true && verified_token !== ''`

### 10.4 What Happens After Verification

On successful OTP verification, the flow continues automatically:

1. Library stores `verified_token` internally
2. Library calls `identityLogin(verified_token)` to check if identity exists
3. **If identity exists:** `handlePostAuthFlow()` is called → tokens stored → navigation trigger
4. **If identity not found (HTTP 404):** UI transitions to registration form
5. **On error:** error banner shown, no navigation

**Critical:** The library handles navigation trigger internally via the `needsOnboarding` or `authComplete` event. The consuming app MUST listen to these events and perform the actual `router.navigate()`.

### 10.5 Historical Bug (Fixed in v1.26.0)

Prior to v1.26.0, a race condition caused duplicate `POST /api/auth/otp/verify` requests:
- First request succeeded, consuming the OTP
- Second request returned 400 (already used)
- UI displayed the second request's error despite success

**Fix:** v1.26.0 added a `loading()` signal guard and synchronous state updates, preventing double-submit. See task #2281.

---

## 11. Response Interpretation Rules

### 11.1 StoneScriptPHP Response Envelope

The library expects responses from StoneScriptPHP backends to follow this envelope (see stonescriptphp SPEC.md §3):

```typescript
interface Envelope<T> {
    status: 'ok' | 'not ok' | 'error';
    message: string;
    data: T | null;
}
```

### 11.2 Success Detection

A response is considered **successful** when ALL of:
- HTTP status is 2xx
- `status === 'ok'`

The library MUST NOT surface a success as an error. If HTTP is 200 and `status` is `'ok'`, the operation succeeded.

### 11.3 Error Detection

A response is an **error** when ANY of:
- HTTP status is 4xx or 5xx
- `status === 'error'` or `status === 'not ok'`

### 11.4 ApiResponse Wrapping

All HTTP responses are wrapped in `ApiResponse<T>`:

```typescript
const response = await api.get<Widget[]>('/widgets');
// response.success is true ONLY if status === 'ok'
// response.message contains error message on failure
```

### 11.5 Auth Responses (Different Format)

The progalaxyelabs-auth server uses a DIFFERENT format (not the StoneScriptPHP envelope):

```typescript
// Auth success (flat format)
{
    access_token: string;
    refresh_token: string;
    identity: { email, display_name, ... };
    membership?: { tenant_id, role, ... };
}

// Auth error
{
    error?: string;   // Error code
    message?: string; // Human-readable
}
```

The `ProgalaxyElabsAuth` plugin handles this format directly. The `StoneScriptPHPAuth` plugin uses `AuthResponseMap` to handle StoneScriptPHP envelope format.

---

## 12. Error Mapping

### 12.1 HTTP Status Mapping

| HTTP Status | User-Facing Treatment | Details |
|-------------|----------------------|---------|
| 2xx | Success | Display data or success message |
| 400 | Verbatim | Show `message` from response body |
| 401 | Redirect | Auto-refresh attempt; on failure, redirect to login |
| 403 | Verbatim | Show `message` (permission denied) |
| 404 | Context-aware | "Not found" or "No data" depending on endpoint |
| 422 | Verbatim | Show validation error messages |
| 429 | Rate limited | "Too many requests. Please wait." |
| 5xx | Generic | "Something went wrong. Please try again." |

### 12.2 OTP Error Mapping

| Error Code | User Message | UI Treatment |
|------------|--------------|--------------|
| `otp_invalid` | "Invalid code. N attempt(s) remaining." | Red banner, stay on code entry |
| `otp_expired` | "Your code has expired. Please request a new one." | Orange banner, return to identifier |
| `otp_rate_limited` | "Too many attempts. Please try again later." | Red banner, return to identifier |
| `otp_not_found` | "No code found. Please request a new one." | Orange banner, return to identifier |

### 12.3 Security: Never Expose Internals

The library MUST NEVER expose to the browser:
- Stack traces
- SQL fragments or database errors
- Framework internal exceptions
- File paths or line numbers
- Sensitive configuration values

5xx errors MUST show a generic message even if the response body contains technical details.

---

## 13. Publish + Consume Policy

### 13.1 npm-publish-first Rule

**NEVER use `file:` dependencies in production.**

Before a consuming app can use library changes:
1. Make changes in ngx-stonescriptphp-client
2. Bump version (`npm version patch|minor|major`)
3. Build (`npm run build`)
4. Publish (`cd dist && npm publish`)
5. Update consumer (`npm update @progalaxyelabs/ngx-stonescriptphp-client`)

### 13.2 SemVer Discipline

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| Bug fix, no API change | PATCH (1.2.3 → 1.2.4) | Fix race condition, improve error message |
| New feature, backward-compatible | MINOR (1.2.3 → 1.3.0) | Add new method, new optional config |
| Breaking change | MAJOR (1.2.3 → 2.0.0) | Remove method, change signature, rename export |

### 13.3 Breaking Changes

A breaking change is ANY of:
- Removing a public method, property, or class
- Changing method signatures (required params, return type)
- Renaming exports
- Changing default behavior
- Removing or renaming configuration options

Breaking changes MUST:
1. Bump major version
2. Document in CHANGELOG.md
3. Provide migration guide

### 13.4 Consumer Upgrade Workflow

```bash
# Check for updates
npm outdated @progalaxyelabs/ngx-stonescriptphp-client

# Update (respects semver in package.json)
npm update @progalaxyelabs/ngx-stonescriptphp-client

# Or update to specific version
npm install @progalaxyelabs/ngx-stonescriptphp-client@1.27.0
```

---

## 14. Signals + Zoneless Compatibility

### 14.1 Requirement

The library MUST work in both:
- **Legacy apps:** Angular with zone.js and traditional change detection
- **Modern apps:** Angular with signals and zoneless change detection (`provideExperimentalZonelessChangeDetection()`)

### 14.2 Implementation (v1.26.0+)

As of v1.26.0, the library's UI components use Angular signals:

```typescript
// Internal state uses signals
loading = signal(false);
error = signal('');
otpStep = signal<'identifier' | 'code' | 'register'>('identifier');

// Template binds to signals
@if (loading()) { <spinner /> }
@if (error()) { <error-banner [message]="error()" /> }
```

### 14.3 Why Signals Matter

Signals provide:
- Synchronous state updates (no NgZone race conditions)
- Fine-grained reactivity (only affected DOM updates)
- Zoneless compatibility (no zone.js dependency for change detection)

The v1.26.0 signals rewrite fixed the duplicate-POST bug (#2281) because signal updates are synchronous — the `loading()` guard works immediately.

### 14.4 Service Compatibility

Services (`AuthService`, `ApiConnectionService`, `TokenService`) are not signal-based — they use Promises and BehaviorSubjects. This is intentional:
- BehaviorSubject works with both zone and zoneless apps
- Promise-based APIs are clearer for async operations
- No breaking change for existing consumers

---

## 15. HTTP Transport

### 15.1 No Angular HttpClient

The library uses **native `fetch()`** for all HTTP requests, not Angular's `HttpClient`.

**Rationale:**
- No HttpClientModule dependency
- Simpler promise-based API
- Works identically in zone and zoneless apps
- Smaller bundle (no Angular HTTP interceptor chain)

### 15.2 No HTTP Interceptors

Because the library uses `fetch()`, Angular HTTP interceptors do NOT apply. The library handles:

| Concern | How Handled |
|---------|-------------|
| Bearer token injection | `ApiConnectionService` adds `Authorization` header |
| 401 refresh-and-retry | `ApiConnectionService` internal logic |
| CSRF token | `ApiConnectionService` reads cookie, adds header |
| Correlation headers | Not implemented (see gap) |

### 15.3 Request Pipeline Order

1. Build URL from `environment.apiServer.host` + endpoint
2. If authenticated, add `Authorization: Bearer {accessToken}`
3. If cookie mode + CSRF enabled, add `X-CSRF-Token` header
4. Execute `fetch()` with `mode: 'cors'`, `redirect: 'error'`
5. If 401 received:
   a. Attempt token refresh via `auth.refresh()`
   b. If refresh succeeds, retry original request once
   c. If refresh fails, emit `signedOut()` event
6. Parse JSON and wrap in `ApiResponse<T>`

### 15.4 Gap: Correlation Headers

The library does NOT currently add request-id or tenant-id correlation headers. This would aid debugging in distributed traces. Implementation pending.

---

## 16. Route-URL Uniqueness

### 16.1 Rule

Every distinct UI state MUST have a unique URL. This applies to:
- Auth steps (identifier entry, OTP code, registration)
- Wizard steps (onboarding page 1, 2, 3)
- Tab states (settings → profile vs settings → billing)
- Filter states (list → all vs list → pending)

### 16.2 Exception

The ONLY exception: inline `@if` error blocks that show/hide without changing the logical "screen":

```html
<!-- OK: error banner is transient, same screen -->
@if (error()) {
    <div class="error">{{ error() }}</div>
}
```

### 16.3 Auth Component Routes

The `<lib-tenant-login>` component maintains internal state (`otpStep` signal) but does NOT control routes. The consuming app MUST:

1. Host the component at a route (e.g., `/login`)
2. Listen to navigation events (`authComplete`, `needsOnboarding`)
3. Navigate to appropriate routes on those events

Example:
```typescript
<lib-tenant-login
    (authComplete)="router.navigate(['/dashboard'])"
    (needsOnboarding)="router.navigate(['/onboarding'])"
/>
```

### 16.4 Gap: OTP Steps Not URL-Addressable

Currently, the OTP flow steps (`identifier` → `code` → `register`) are internal signals, not URL segments. A user refreshing during code entry loses their place. This is a known limitation.

Future improvement: URL fragments or query params for step state (e.g., `/login?step=code`).

---

## Appendix A: Built-in Auth Plugins Comparison

| Feature | `ProgalaxyElabsAuth` | `StoneScriptPHPAuth` |
|---------|---------------------|---------------------|
| Backend | Rust/Axum auth server | StoneScriptPHP API |
| Token transport | Body mode | Configurable (cookie or body) |
| Response format | Native flat JSON | StoneScriptPHP `{ status, data }` (configurable via `AuthResponseMap`) |
| OTP support | Yes | Depends on backend |
| OAuth support | Yes | Depends on backend |
| Password login | No | Yes |
| Multi-server | No | Yes |
| CSRF | No | Yes (cookie mode) |

## Appendix B: localStorage Keys Reference

| Key | Owner | Description |
|-----|-------|-------------|
| `progalaxyapi_access_token` | `TokenService` | JWT access token |
| `progalaxyapi_refresh_token` | `TokenService` | JWT refresh token |
| `progalaxyapi_user` | `AuthService` | Serialized User object |
| `progalaxyapi_active_auth_server` | `StoneScriptPHPAuth` plugin | Active server name in multi-server mode |

## Appendix C: Implementation Gaps Summary

| Section | Gap | File:Line | Priority |
|---------|-----|-----------|----------|
| 3.2 | `TokenService` mutation methods are public; should be internal-only | `src/token.service.ts:*` | Medium |
| 5.4 | `FilesService` duplicates refresh-and-retry logic | `src/files.service.ts:*` | Low |
| 6.3 | No ESLint plugin/config shipped for raw fetch prevention | — | Medium |
| 7 | No route guards shipped; all implemented per-platform | — | High |
| 7.2 | `provideNgxStoneScriptPhpClient` does not accept route config for guards | `src/provide.ts` | High |
| 15.4 | No request-id or tenant-id correlation headers | `src/api-connection.service.ts` | Low |
| 16.4 | OTP flow steps not URL-addressable; refresh loses state | `src/lib/components/tenant-login.component.ts:*` | Medium |

### Historical Gap (FIXED)

| Version | Gap | Resolution |
|---------|-----|------------|
| Pre-1.26.0 | Duplicate OTP verify POST due to zone.js race condition | Fixed in v1.26.0 by signals rewrite (#2281, #2234) |
