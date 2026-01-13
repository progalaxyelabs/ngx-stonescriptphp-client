# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2025-12-26

### Changed
- **Repository organization**: Removed files array from package.json for cleaner npm publishing
- **Minor improvements**: Build configuration refinements

### Documentation
- Updated package description and metadata
- No API changes from v1.1.1

---

## [1.1.1] - 2025-12-20

### Fixed
- **Build improvements**: Enhanced build configuration for better compatibility
- **Package metadata**: Updated dependencies and peer dependencies

### Documentation
- Minor documentation refinements
- No breaking changes from v1.1.0

---

## [1.1.0] - 2025-12-18

### Added
- **Enhanced authentication flexibility**: Additional configuration options for auth modes
- **Improved error handling**: Better error messages for authentication failures
- **Type safety improvements**: Enhanced TypeScript definitions

### Changed
- **Build system updates**: Updated to Angular 20.0.0 for development
- **Peer dependencies**: Now supports Angular ^19.0.0 || ^20.0.0

### Documentation
- Updated README with clearer authentication examples
- Enhanced API documentation

---

## [1.0.0] - 2025-12-14

### 🎉 Production Ready Release

This is the first stable production release of `@progalaxyelabs/ngx-stonescriptphp-client`.

#### Repository Organization
- **Documentation**: Moved CHANGELOG.md and AUTH_COMPATIBILITY.md to `docs/` folder
- **Project Structure**: Cleaned up root directory - only README.md and HLD.md remain
- **.gitignore**: Updated for proper npm package exclusions
- **package.json**: Added `docs` folder to published files

#### Why 1.0.0?
- ✅ Full compatibility with StoneScriptPHP Framework v2.1.x
- ✅ All major HTTP methods implemented (GET, POST, PUT, PATCH, DELETE)
- ✅ Configurable authentication modes (cookie/body/none)
- ✅ CSRF protection support
- ✅ Comprehensive documentation
- ✅ Clean repository structure
- ✅ Production-ready and stable API

**No code changes from v0.0.15** - purely organizational improvements and version bump to indicate production readiness.

---

## [0.0.15] - 2025-12-14 (Pre-release)

### 🎉 Major Feature: Configurable Authentication Modes

This release adds **full compatibility with StoneScriptPHP Framework v2.1.x authentication** while maintaining backward compatibility.

### Added

#### Authentication Configuration
- **`AuthConfig` interface**: Configure authentication mode, endpoints, and CSRF settings
- **`AuthMode` type**: Choose between `'cookie'`, `'body'`, or `'none'` authentication modes
- **Cookie-based auth mode**: Full support for StoneScriptPHP v2.1.x secure httpOnly cookie + CSRF auth (recommended)
- **Body-based auth mode**: Legacy mode for custom backends (sends tokens in request body)
- **No-auth mode**: Disable automatic token refresh for manual auth management

#### New Services & Methods
- **`CsrfService`**: Manage CSRF tokens from cookies for secure authentication
- **`TokenService.setAccessToken()`**: Set only access token
- **`TokenService.setRefreshToken()`**: Set only refresh token
- **`MyEnvironmentModel.auth`**: Authentication configuration object

### Changed

#### Auth Mode Configuration (Breaking Change with Migration Path)
- **Default auth mode**: Now defaults to `'cookie'` mode (StoneScriptPHP v2.1.x compatible)
- **Token refresh**: Completely rewritten to support multiple auth strategies:
  - **Cookie mode**: Uses httpOnly cookies + CSRF tokens, calls `/auth/refresh` (default)
  - **Body mode**: Sends tokens in request body (legacy), calls `/user/refresh_access`
  - **None mode**: Disables automatic token refresh

#### Migration Guide for v0.0.10 → v0.0.15

**For StoneScriptPHP v2.1.x users (recommended):**
```typescript
// environment.ts
export const environment = {
    apiServer: { host: 'http://localhost:8000/' },
    auth: {
        mode: 'cookie',  // Default, can omit
        refreshEndpoint: '/auth/refresh'  // Default, can omit
    }
}
```

**For legacy/custom backend users:**
```typescript
// environment.ts
export const environment = {
    apiServer: { host: 'http://localhost:8000/' },
    auth: {
        mode: 'body',
        refreshEndpoint: '/user/refresh_access'
    }
}
```

**To disable auto-refresh:**
```typescript
// environment.ts
export const environment = {
    apiServer: { host: 'http://localhost:8000/' },
    auth: { mode: 'none' }
}
```

### Fixed
- ✅ **Authentication compatibility with StoneScriptPHP v2.1.x** - Now fully compatible!
- ✅ Cookie-based auth with CSRF protection
- ✅ Configurable refresh endpoints
- ✅ Proper error handling in both auth modes

### Documentation
- Updated [AUTH_COMPATIBILITY.md](AUTH_COMPATIBILITY.md) (in docs/) - Auth now fully compatible!
- Added configuration examples for all auth modes
- Comprehensive migration guide

---

## [0.0.13] - 2025-12-14 (Skipped - Never Published)

### Added

#### ApiConnectionService
- **DELETE method**: Added `delete<T>(endpoint: string, queryParamsObj?: any): Promise<ApiResponse<T>>` for DELETE HTTP requests
- **PUT method**: Added `put<T>(pathWithQueryParams: string, data: any): Promise<ApiResponse<T>>` for PUT HTTP requests (full updates)
- **PATCH method**: Added `patch<T>(pathWithQueryParams: string, data: any): Promise<ApiResponse<T>>` for PATCH HTTP requests (partial updates)

#### ApiResponse Model
- **isSuccess()**: Returns `true` if status is 'ok'
- **isError()**: Returns `true` if status is 'error' or 'not ok'
- **getData()**: Returns the data payload or null
- **getError()**: Returns the error message or 'Unknown error'
- **getStatus()**: Returns the status string
- **getMessage()**: Returns the message string

### Fixed
- Version synchronization between root package.json (0.0.12) and library package.json (was 0.0.10, now 0.0.12)

### Notes
- `onOk()` and `onNotOk()` methods were already present in ApiResponse (since earlier versions)
- `DbService` is exported but remains unimplemented - placeholder for future database query functionality

## [0.0.10] - 2025-12-08

### Published to NPM
- Initial NPM release with GET and POST methods
- Basic authentication flow with token refresh
- ApiResponse model with `onOk()`, `onNotOk()`, and `onError()` callbacks

## [0.0.9] - 2025-12-07

### Changed
- Documentation improvements
- README updates for npm presentation

## [0.0.8] - 2025-12-06

### Changed
- Package naming fixes
- Documentation updates

---

## Migration Guide: v0.0.10 → v0.0.13

### New HTTP Methods Available

You can now use all standard REST HTTP methods:

```typescript
// Before (v0.0.10) - Had to use raw HttpClient for these operations
constructor(private http: HttpClient) {}
this.http.delete(`${apiUrl}/users/${id}`).subscribe(...)

// After (v0.0.13) - Use ApiConnectionService directly
constructor(private apiConnection: ApiConnectionService) {}

// DELETE
await this.apiConnection.delete(`/users/${id}`)
await this.apiConnection.delete(`/users/${id}`, { force: true }) // with query params

// PUT (full update)
await this.apiConnection.put(`/users/${id}`, { name: 'John', email: 'john@example.com' })

// PATCH (partial update)
await this.apiConnection.patch(`/users/${id}`, { name: 'John' })
```

### New ApiResponse Helper Methods

```typescript
// Before (v0.0.10) - Manual status checking
const response = await this.apiConnection.get('/users')
if (response.status === 'ok') {
    this.users = response.data
} else {
    this.error = response.message
}

// After (v0.0.13) - Use helper methods
const response = await this.apiConnection.get('/users')

// Option 1: Helper methods
if (response.isSuccess()) {
    this.users = response.getData()
} else {
    this.error = response.getError()
}

// Option 2: Fluent API (still available)
response
    .onOk(data => this.users = data)
    .onNotOk((message, data) => this.error = message)
    .onError(() => console.error('Network error'))
```

---

## Known Issues

### 🔴 CRITICAL: Authentication Flow Incompatibility

The token refresh mechanism in v0.0.13 is **incompatible** with StoneScriptPHP Framework v2.1.x built-in authentication.

**Issue**: Client expects `/user/refresh_access` endpoint with tokens in request body, but the framework's built-in `RefreshRoute` uses:
- Endpoint: `/auth/refresh` (default, customizable)
- Security: httpOnly cookies + CSRF tokens
- Does NOT accept tokens in request body

**Impact**:
- ✅ **Works**: General API calls (GET, POST, PUT, PATCH, DELETE) with manual token management
- ❌ **Broken**: Automatic token refresh on 401 errors
- ⚠️ **Workaround**: Implement custom `/user/refresh_access` route on your backend OR manage auth manually

**See**: [AUTH_COMPATIBILITY.md](AUTH_COMPATIBILITY.md) for detailed analysis and solutions.

**Fix Planned**: v0.0.14 will add configurable auth modes to support both cookie-based and body-based authentication.

### DbService (Not Yet Implemented)
The `DbService` is exported in the public API but contains no implementation. It is a placeholder for future database query functionality. Do not use it in production.

### Angular Version Compatibility
The package is built with Angular 16 but declares peer dependencies for Angular 16-20. While it should work across these versions, comprehensive testing has only been done with Angular 16. If you encounter issues with Angular 19/20, please report them at: https://github.com/progalaxyelabs/ngx-stonescriptphp-client/issues

---

## Roadmap

### Planned for v0.0.13+
- Complete `DbService` implementation with type-safe database queries
- HTTP interceptor support for custom auth/logging/retry logic
- File upload/download support
- Comprehensive unit tests
- Rebuild with Angular 19/20 for production

### Future Versions
- RxJS operators for common patterns
- WebSocket support for real-time features
- Migration to `@stonescriptphp` namespace
- Demo application and Storybook documentation

---

## Links

- **NPM Package**: https://www.npmjs.com/package/@progalaxyelabs/ngx-stonescriptphp-client
- **GitHub Repository**: https://github.com/progalaxyelabs/ngx-stonescriptphp-client
- **StoneScriptPHP Framework**: https://stonescriptphp.org
- **Report Issues**: https://github.com/progalaxyelabs/ngx-stonescriptphp-client/issues
