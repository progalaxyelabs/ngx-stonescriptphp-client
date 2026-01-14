# Modal-Based Authentication Specification

**Version:** 2.0.0
**Last Updated:** 2026-01-14
**Status:** Implemented

---

## Overview

Modal-based authentication allows users to authenticate without leaving the application. Authentication happens via:
- **Email/Password**: Direct API calls to accounts platform
- **OAuth (Google, LinkedIn, Apple, Microsoft, GitHub)**: Popup windows with postMessage communication

Users remain on the application throughout the authentication flow.

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│  Platform Application (progalaxy.in)              │
│                                                    │
│  LoginDialog → AuthService → Accounts Platform    │
│  (Platform)     (Library)      (API)              │
│                                                    │
│  - Renders UI   - Auth logic    - Validates       │
│  - Collects     - Token mgmt    - Returns tokens  │
│    credentials  - Popup OAuth   - Sets cookies    │
└────────────────────────────────────────────────────┘
```

**Separation of Concerns:**
- **Platform**: Builds login UI (dialog/modal/page), decides which providers to show
- **Library (ngx-client)**: Provides AuthService with authentication methods
- **Accounts Platform**: Centralized auth API, validates credentials, returns tokens

---

## Supported Providers

| Provider | Type | Use Case |
|----------|------|----------|
| `google` | OAuth | Consumer authentication |
| `linkedin` | OAuth | Professional/B2B platforms |
| `apple` | OAuth | iOS apps, privacy-focused |
| `microsoft` | OAuth | Enterprise applications |
| `github` | OAuth | Developer platforms |
| `emailPassword` | Credentials | Traditional login |

---

## Configuration

### Platform Configuration (environment.ts)

```typescript
export const environment = {
  platformCode: 'progalaxy',
  accountsUrl: 'https://accounts.progalaxyelabs.com'
};
```

**Authentication providers are configured when opening the login dialog, not in environment.**

---

## AuthService Interface

### Types

```typescript
type AuthProvider = 'google' | 'linkedin' | 'apple' | 'microsoft' | 'github' | 'emailPassword';

interface User {
  user_id: number;
  email: string;
  display_name: string;
  photo_url?: string;
  is_email_verified: boolean;
}

interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
}
```

### Authentication Methods

```typescript
class AuthService {
  // Observable user state
  user$: Observable<User | null>;

  // Email/Password
  loginWithEmail(email: string, password: string): Promise<AuthResult>
  register(email: string, password: string, displayName: string): Promise<AuthResult>

  // OAuth (provider-specific)
  loginWithGoogle(): Promise<AuthResult>
  loginWithLinkedIn(): Promise<AuthResult>
  loginWithApple(): Promise<AuthResult>
  loginWithMicrosoft(): Promise<AuthResult>
  loginWithGitHub(): Promise<AuthResult>

  // OAuth (generic)
  loginWithProvider(provider: AuthProvider): Promise<AuthResult>

  // Session management
  checkSession(): Promise<boolean>
  signout(): Promise<void>
  isAuthenticated(): boolean
  getCurrentUser(): User | null
}
```

---

## Authentication Flows

### Email/Password Flow

```
Platform UI → AuthService.loginWithEmail(email, password)
              ↓
              POST accounts.com/api/auth/login
              { email, password, platform: 'progalaxy' }
              ↓
              Response: { success, access_token, user }
              ↓
              - Stores access token in localStorage
              - Sets refresh_token cookie (httpOnly)
              - Updates user$ Observable
              - Returns AuthResult
```

### OAuth Flow (Popup)

```
Platform UI → AuthService.loginWithGoogle()
              ↓
              Opens popup: accounts.com/oauth/google?platform=progalaxy&mode=popup
              ↓
              User authenticates with Google
              ↓
              Accounts platform renders HTML with postMessage:
              window.opener.postMessage({
                type: 'oauth_success',
                access_token: '...',
                user: { ... }
              })
              ↓
              - Stores access token in localStorage
              - Sets refresh_token cookie (httpOnly)
              - Updates user$ Observable
              - Closes popup
              - Returns AuthResult
```

---

## Accounts Platform API

### Endpoints Required

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/register` | POST | User registration |
| `/api/auth/logout` | POST | Sign out |
| `/api/auth/refresh` | POST | Refresh access token |
| `/oauth/{provider}` | GET | OAuth initiation (google, linkedin, apple, microsoft, github) |

### Request/Response Format

**Login Request:**
```json
{
  "email": "user@example.com",
  "password": "...",
  "platform": "progalaxy"
}
```

**Success Response:**
```json
{
  "success": true,
  "access_token": "eyJ...",
  "user": {
    "user_id": 123,
    "email": "user@example.com",
    "display_name": "John Doe",
    "photo_url": "https://...",
    "is_email_verified": true
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

## UI Components (Provided by Library)

**The library provides ready-to-use UI components** for consistent authentication across all platforms:

### Components Included

- **LoginComponent** - Email/password login form with OAuth buttons
- **RegisterComponent** - User registration form
- **OAuth buttons** - Dynamically rendered based on enabled providers
- **Loading states** - Visual feedback during authentication
- **Error messages** - User-friendly error display

### Platform Usage

Platforms simply:
1. Configure which providers to enable in `environment.ts`
2. Import and use the library's login/register components
3. The library handles all UI rendering, form validation, and API communication

**Benefits:**
- ✅ Consistent UX across all platforms
- ✅ Centralized maintenance
- ✅ Proper integration with accounts platform API
- ✅ No duplicate code across platforms

### Usage Example

```typescript
// Platform: app.component.ts
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LoginDialogComponent } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-root',
  template: `<button (click)="openLogin()">Sign In</button>`
})
export class AppComponent {
  constructor(private dialog: MatDialog) {}

  openLogin() {
    const dialogRef = this.dialog.open(LoginDialogComponent, {
      width: '400px',
      disableClose: true
    });

    // REQUIRED: Specify which providers to show
    dialogRef.componentInstance.providers = ['google', 'linkedin', 'emailPassword'];
  }
}
```

**The `LoginDialogComponent`**:
- Requires `providers` input (throws error if not provided)
- Renders appropriate login forms and OAuth buttons based on providers array
- Handles all authentication logic
- Shows loading states and error messages
- Closes dialog on successful login

**Examples:**

```typescript
// Google + Email only
dialogRef.componentInstance.providers = ['google', 'emailPassword'];

// All professional providers
dialogRef.componentInstance.providers = ['google', 'linkedin', 'microsoft', 'emailPassword'];

// Email only
dialogRef.componentInstance.providers = ['emailPassword'];

// All OAuth providers
dialogRef.componentInstance.providers = ['google', 'linkedin', 'apple', 'microsoft', 'github'];
```

---

## Session Management

**On App Init:**
```typescript
// app.component.ts
async ngOnInit() {
  const hasSession = await this.auth.checkSession();
  if (hasSession) {
    // User is authenticated, access token refreshed
    const user = this.auth.getCurrentUser();
  } else {
    // Show login dialog
  }
}
```

**Reactive UI:**
```typescript
// Any component
this.auth.user$.subscribe(user => {
  if (user) {
    console.log('Logged in:', user.display_name);
  } else {
    console.log('Not authenticated');
  }
});
```

---

## Security

- **Access Tokens**: Stored in `localStorage`, sent in `Authorization: Bearer` header
- **Refresh Tokens**: Stored in httpOnly cookies (XSS-safe), managed by browser
- **CSRF Protection**: Included automatically for API calls
- **Origin Verification**: OAuth popup validates `postMessage` origin
- **Popup Blocking**: Graceful fallback if popups blocked

---

## Migration from v1.x

**No breaking changes.** All existing functionality works unchanged.

**New in v2.0.0:**
- Added LinkedIn, Apple, Microsoft OAuth support
- Added declarative provider configuration
- Added `loginWithProvider()`, `getAvailableProviders()`, `isProviderEnabled()`
- Added `user$` Observable for reactive state
- Added `checkSession()` for automatic token refresh

---

## References

- **Full Implementation Examples**: [AUTH-PROVIDER-CONFIG.md](AUTH-PROVIDER-CONFIG.md)
- **Interface Specification**: [INTERFACE-SPECIFICATION.md](INTERFACE-SPECIFICATION.md)
- **Architecture Details**: [HLD.md](HLD.md)
