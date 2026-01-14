# ngx-stonescriptphp-client - High Level Design

**Version**: 2.0.0
**Last Updated**: 2026-01-14

## Overview
Official Angular HTTP client library for StoneScriptPHP backend framework with built-in authentication UI components.

## Purpose
Provides type-safe HTTP calls to StoneScriptPHP APIs using auto-generated TypeScript interfaces with full authentication support and ready-to-use login/registration components.

## Architecture

### Core Services

#### ApiConnectionService
- HTTP client wrapper with automatic error handling
- Supports all standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Automatic token refresh on 401 errors
- Configurable authentication modes
- Promise-based API for simpler async handling

#### TokenService
- Secure token storage and retrieval
- Access token and refresh token management
- Support for both cookie-based and body-based auth
- Automatic token expiry handling

#### CsrfService
- CSRF token management from cookies
- Automatic CSRF header injection
- Compatible with StoneScriptPHP v2.1.x CSRF protection

#### SigninStatusService
- Authentication state management
- Observable-based signin status tracking
- Session lifecycle management

#### AuthService (NEW in v2.0.0)
- Multi-provider OAuth authentication (Google, LinkedIn, Apple, Microsoft, GitHub)
- Email/password authentication
- Session management with token refresh
- User state Observable (`user$`)
- Popup-based OAuth flow with postMessage communication

#### DbService
- Placeholder for future IndexedDB integration
- Reserved for offline storage capabilities

### UI Components (NEW in v2.0.0)

The library provides standalone Angular components for authentication:

#### LoginDialogComponent
- **Purpose**: Pre-built login UI with dynamic provider rendering
- **Features**:
  - Email/password login form
  - OAuth provider buttons (Google, LinkedIn, Apple, Microsoft, GitHub)
  - Loading states and error handling
  - Configurable providers via input property
- **Usage**: Import and open in Material Dialog or any modal system

#### RegisterComponent
- **Purpose**: User registration form
- **Features**:
  - Full name, email, password, confirm password fields
  - Client-side validation
  - Success/error messaging
- **Usage**: Standalone component for registration flows

**Key Design Decision**: Providers are configured when opening the dialog (not in environment), allowing different dialogs to show different authentication options.

### Authentication Architecture

The library supports three authentication modes configurable via environment settings:

#### 1. Cookie-based Auth (Recommended)
- **Security**: httpOnly cookies + CSRF tokens
- **Compatibility**: StoneScriptPHP v2.1.x default
- **Token Storage**: Server-managed httpOnly cookies
- **CSRF Protection**: Automatic via CsrfService
- **Refresh Endpoint**: `/auth/refresh` (configurable)

#### 2. Body-based Auth (Legacy)
- **Use Case**: Custom backends, legacy systems
- **Token Storage**: Client-managed (localStorage/sessionStorage)
- **Token Transmission**: Request body
- **Refresh Endpoint**: `/user/refresh_access` (configurable)

#### 3. Manual Auth (None)
- **Use Case**: Custom authentication logic
- **Auto-refresh**: Disabled
- **Implementation**: Developer-managed

### Data Flow

#### API Request Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     Angular Application                      │
│                                                              │
│  ┌───────────────┐      ┌─────────────────┐                │
│  │  Component    │──────│ ApiConnection   │                │
│  │               │      │   Service       │                │
│  └───────────────┘      └────────┬────────┘                │
│                                  │                          │
│                         ┌────────▼─────────┐               │
│                         │  TokenService    │               │
│                         │  CsrfService     │               │
│                         └────────┬─────────┘               │
└──────────────────────────────────┼──────────────────────────┘
                                   │
                          HTTP + Auth Headers
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│              StoneScriptPHP Backend (v2.1.x)                 │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Auth Routes  │      │   API Routes │                    │
│  │ /auth/*      │      │   /api/*     │                    │
│  └──────────────┘      └──────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

#### Modal Authentication Flow (v2.0.0)
```
┌─────────────────────────────────────────────────────────────┐
│                  Platform Application                        │
│                                                              │
│  ┌────────────────────────────────────────┐                │
│  │  MatDialog.open(LoginDialogComponent)  │                │
│  │  providers = ['google', 'emailPassword']│                │
│  └────────────┬───────────────────────────┘                │
│               │                                              │
│       ┌───────▼──────────┐                                  │
│       │ LoginDialog      │                                  │
│       │ (from library)   │                                  │
│       │ - Email form     │                                  │
│       │ - OAuth buttons  │                                  │
│       └───────┬──────────┘                                  │
│               │                                              │
│       ┌───────▼──────────┐                                  │
│       │   AuthService    │                                  │
│       │ - loginWithEmail()│                                 │
│       │ - loginWithGoogle()│                                │
│       └───────┬──────────┘                                  │
└───────────────┼──────────────────────────────────────────────┘
                │
       ┌────────▼─────────┐
       │  OAuth Popup     │ (for OAuth providers)
       │  postMessage     │
       └────────┬─────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│           Accounts Platform API                              │
│  - /api/auth/login (email/password)                         │
│  - /oauth/google (OAuth providers)                          │
│  - /api/auth/register                                       │
│  - /api/auth/refresh                                        │
└─────────────────────────────────────────────────────────────┘
```

### Type Safety Flow

1. **Backend**: Developer defines PHP DTOs and contracts in StoneScriptPHP
2. **Generation**: `php stone generate typescript-client` creates TypeScript interfaces
3. **Frontend**: Angular imports generated interfaces
4. **API Calls**: Type-safe HTTP calls with compile-time validation
5. **Response**: Runtime validation against ApiResponse<T> model

## Tech Stack

### Dependencies
- **Angular Common**: >= 19.0.0 or 20.0.0
- **Angular Core**: >= 19.0.0 or 20.0.0
- **Angular Forms**: >= 19.0.0 or 20.0.0 (NEW in v2.0.0)
- **TypeScript**: >= 5.8.0
- **tslib**: ^2.8.0

### Build Tools
- **ng-packagr**: ^20.0.0 (Angular package builder)
- **TypeScript Compiler**: ~5.8.0
- **Strict Templates**: Enabled for enhanced template type checking

## API Response Model

All responses follow the standardized ApiResponse structure:

```typescript
interface ApiResponse<T> {
  status: 'ok' | 'error';
  message: string;
  data: T;

  // Helper methods
  isSuccess(): boolean;
  isError(): boolean;
  getData(): T | null;
  getError(): string;
  getStatus(): string;
  getMessage(): string;

  // Callback methods
  onOk(callback: (data: T) => void): ApiResponse<T>;
  onNotOk(callback: (message: string, data: T) => void): ApiResponse<T>;
  onError(callback: () => void): ApiResponse<T>;
}
```

## Environment Configuration

Developers configure the client via the environment file:

```typescript
interface MyEnvironmentModel {
  production: boolean;
  platformCode: string;           // NEW in v2.0.0 - for multi-tenant auth
  accountsUrl: string;            // NEW in v2.0.0 - centralized auth platform
  apiServer: {
    host: string;
  };
  auth: {
    mode: 'cookie' | 'body' | 'none';
    refreshEndpoint?: string;
    useCsrf?: boolean;
    refreshTokenCookieName?: string;
    csrfTokenCookieName?: string;
    csrfHeaderName?: string;
  };
}
```

**Note**: Authentication providers are NOT configured in environment. They are specified when opening the login dialog.

## Distribution

- **Package Name**: `@progalaxyelabs/ngx-stonescriptphp-client`
- **NPM Registry**: https://www.npmjs.com/package/@progalaxyelabs/ngx-stonescriptphp-client
- **Repository**: https://github.com/progalaxyelabs/ngx-stonescriptphp-client
- **Future**: Migration to `@stonescriptphp` namespace planned

## Version History

- **v2.0.0** (Current): Modal-based authentication with UI components
  - Added `LoginDialogComponent` with dynamic provider rendering
  - Added `RegisterComponent` for user registration
  - Added `AuthService` with multi-provider OAuth support (Google, LinkedIn, Apple, Microsoft, GitHub)
  - Added centralized accounts platform integration
  - Provider configuration via dialog input (not environment)
  - Angular 20 control flow syntax (`@if`, `@for`)
  - Strict template type checking enabled
  - Added `@angular/forms` peer dependency
- **v1.1.2**: Repository organization improvements
- **v1.1.1**: Build configuration enhancements
- **v1.1.0**: Enhanced authentication flexibility, Angular 20 support
- **v1.0.0**: First production release, full StoneScriptPHP v2.1.x compatibility
- **v0.0.15**: Added configurable authentication modes
- **v0.0.13**: Added PUT, PATCH, DELETE methods (never published)
- **v0.0.10**: Initial NPM release with GET, POST methods

## Known Limitations

1. **DbService**: Not yet implemented - placeholder for future offline storage
2. **WebSocket Support**: Not yet available - planned for future versions
3. **File Upload**: Basic support via FormData, enhanced features planned
4. **UI Customization**: Components have inline styles; CSS customization limited to class overrides
5. **Dialog Dependency**: LoginDialogComponent works best with Material Dialog but is framework-agnostic

## Roadmap

### Planned Features
- Complete DbService implementation for offline data storage
- WebSocket integration for real-time features
- Enhanced file upload/download capabilities
- Comprehensive unit test coverage
- RxJS operators for common API patterns
- Demo application and examples
- Themeable UI components (Material Design integration)
- Password reset/forgot password flows
- Email verification components
- Migration to `@stonescriptphp` namespace

## Security Considerations

1. **Cookie-based Auth**: Recommended for production - prevents XSS attacks via httpOnly cookies
2. **CSRF Protection**: Automatically enabled in cookie mode
3. **Token Storage**: Avoid localStorage for sensitive tokens in production
4. **HTTPS**: Always use HTTPS in production environments
5. **Token Rotation**: Refresh tokens are rotated on each refresh request
6. **OAuth Security** (NEW in v2.0.0):
   - Popup-based flow prevents redirect vulnerabilities
   - Origin verification via postMessage
   - No client-side OAuth secrets (handled by accounts platform)
   - Short-lived access tokens with automatic refresh
7. **Input Validation**: Client-side validation in RegisterComponent (server-side validation still required)

## Support & Contributing

- **Issues**: https://github.com/progalaxyelabs/ngx-stonescriptphp-client/issues
- **Framework Docs**: https://stonescriptphp.org
- **License**: MIT
