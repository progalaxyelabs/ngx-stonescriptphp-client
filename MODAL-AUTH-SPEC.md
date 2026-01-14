# Modal-Based Authentication Specification

**Version:** 2.0.0
**Last Updated:** 2026-01-14
**Status:** Enhanced Specification

---

## Overview

This specification extends the ngx-stonescriptphp-client to support **modal/dialog-based authentication** instead of full-page redirects. Users remain on the application and interact with a customizable login dialog that communicates with the accounts platform API in the background.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Angular Application (progalaxy.in)                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  LoginDialogComponent                               │   │
│  │  - Email/Password form                              │   │
│  │  - Social login buttons (Google, GitHub)            │   │
│  │  - Customizable (show/hide options)                 │   │
│  │  - Loading states, error messages                   │   │
│  └───────────────┬─────────────────────────────────────┘   │
│                  │                                           │
│                  ↓ user clicks "Login with Google"          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  AuthService (from ngx-client)                      │   │
│  │  - loginWithEmail(email, password)                  │   │
│  │  - loginWithGoogle()                                │   │
│  │  - loginWithGitHub()                                │   │
│  │  - register(email, password, name)                  │   │
│  │  - user$: BehaviorSubject<User>                     │   │
│  └───────────────┬─────────────────────────────────────┘   │
│                  │                                           │
│                  ↓ Makes API call / Opens OAuth popup       │
└──────────────────┼───────────────────────────────────────────┘
                   │
                   ↓ POST /api/auth/login (email/password)
                   ↓ GET /api/auth/oauth/google (OAuth)
┌──────────────────┴───────────────────────────────────────────┐
│  Accounts Platform API (api.accounts.progalaxyelabs.com)    │
│  - POST /api/auth/login                                     │
│  - POST /api/auth/register                                  │
│  - GET  /api/auth/oauth/{provider}                          │
│  - POST /api/auth/refresh                                   │
│  - POST /api/auth/logout                                    │
│                                                              │
│  Returns: { success, access_token, user }                   │
│  Sets: refresh_token (httpOnly cookie)                      │
└──────────────────────────────────────────────────────────────┘
```

---

## AuthService API

### Interface

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  user_id: number;
  email: string;
  display_name: string;
  photo_url?: string;
  is_email_verified: boolean;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Observable user state
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$: Observable<User | null> = this.userSubject.asObservable();

  constructor(
    private tokens: TokenService,
    private signinStatus: SigninStatusService,
    private environment: MyEnvironmentModel
  ) {}

  /**
   * Login with email and password
   */
  async loginWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await fetch(
        `${this.environment.accountsUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Include cookies for refresh token
          body: JSON.stringify({
            email,
            password,
            platform: this.environment.platformCode
          })
        }
      );

      const data = await response.json();

      if (data.success && data.access_token) {
        this.tokens.setAccessToken(data.access_token);
        this.signinStatus.setSigninStatus(true);
        this.userSubject.next(data.user);

        return { success: true, user: data.user };
      }

      return {
        success: false,
        message: data.message || 'Invalid credentials'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Network error. Please try again.'
      };
    }
  }

  /**
   * Login with Google OAuth (popup window)
   */
  async loginWithGoogle(): Promise<AuthResult> {
    return this.loginWithOAuth('google');
  }

  /**
   * Login with GitHub OAuth (popup window)
   */
  async loginWithGitHub(): Promise<AuthResult> {
    return this.loginWithOAuth('github');
  }

  /**
   * Generic OAuth login handler
   * Opens popup window and listens for postMessage
   */
  private async loginWithOAuth(provider: string): Promise<AuthResult> {
    return new Promise((resolve) => {
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const oauthUrl = `${this.environment.accountsUrl}/oauth/${provider}?` +
        `platform=${this.environment.platformCode}&` +
        `mode=popup`;

      const popup = window.open(
        oauthUrl,
        `${provider}_login`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        resolve({
          success: false,
          message: 'Popup blocked. Please allow popups for this site.'
        });
        return;
      }

      // Listen for message from popup
      const messageHandler = (event: MessageEvent) => {
        // Verify origin
        if (event.origin !== new URL(this.environment.accountsUrl).origin) {
          return;
        }

        if (event.data.type === 'oauth_success') {
          this.tokens.setAccessToken(event.data.access_token);
          this.signinStatus.setSigninStatus(true);
          this.userSubject.next(event.data.user);

          window.removeEventListener('message', messageHandler);
          popup.close();

          resolve({
            success: true,
            user: event.data.user
          });
        } else if (event.data.type === 'oauth_error') {
          window.removeEventListener('message', messageHandler);
          popup.close();

          resolve({
            success: false,
            message: event.data.message || 'OAuth login failed'
          });
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          resolve({
            success: false,
            message: 'Login cancelled'
          });
        }
      }, 500);
    });
  }

  /**
   * Register new user
   */
  async register(
    email: string,
    password: string,
    displayName: string
  ): Promise<AuthResult> {
    try {
      const response = await fetch(
        `${this.environment.accountsUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password,
            display_name: displayName,
            platform: this.environment.platformCode
          })
        }
      );

      const data = await response.json();

      if (data.success && data.access_token) {
        this.tokens.setAccessToken(data.access_token);
        this.signinStatus.setSigninStatus(true);
        this.userSubject.next(data.user);

        return {
          success: true,
          user: data.user,
          message: data.needs_verification ? 'Please verify your email' : undefined
        };
      }

      return {
        success: false,
        message: data.message || 'Registration failed'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Network error. Please try again.'
      };
    }
  }

  /**
   * Sign out user
   */
  async signout(): Promise<void> {
    try {
      await fetch(
        `${this.environment.accountsUrl}/api/auth/logout`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      this.tokens.clear();
      this.signinStatus.setSigninStatus(false);
      this.userSubject.next(null);
    }
  }

  /**
   * Check for active session (call on app init)
   */
  async checkSession(): Promise<boolean> {
    if (this.tokens.hasValidAccessToken()) {
      this.signinStatus.setSigninStatus(true);
      return true;
    }

    // Try to refresh using httpOnly cookie
    try {
      const response = await fetch(
        `${this.environment.accountsUrl}/api/auth/refresh`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );

      if (!response.ok) {
        this.signinStatus.setSigninStatus(false);
        return false;
      }

      const data = await response.json();

      if (data.access_token) {
        this.tokens.setAccessToken(data.access_token);
        this.userSubject.next(data.user);
        this.signinStatus.setSigninStatus(true);
        return true;
      }

      return false;
    } catch (error) {
      this.signinStatus.setSigninStatus(false);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens.hasValidAccessToken();
  }

  /**
   * Get current user (synchronous)
   */
  getCurrentUser(): User | null {
    return this.userSubject.value;
  }
}
```

---

## LoginDialogComponent (Platform-Specific)

Platforms create their own login dialog component with customizable options:

```typescript
// login-dialog.component.ts
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AuthService, AuthResult } from '@progalaxyelabs/ngx-stonescriptphp-client';

interface LoginConfig {
  allowEmail: boolean;
  allowGoogle: boolean;
  allowGitHub: boolean;
  showRegister: boolean;
}

@Component({
  selector: 'app-login-dialog',
  templateUrl: './login-dialog.component.html',
  styleUrls: ['./login-dialog.component.css']
})
export class LoginDialogComponent {
  // Customizable configuration
  config: LoginConfig = {
    allowEmail: true,
    allowGoogle: true,
    allowGitHub: true,
    showRegister: true
  };

  mode: 'login' | 'register' = 'login';
  loading = false;
  error = '';

  // Form fields
  email = '';
  password = '';
  displayName = '';

  constructor(
    private auth: AuthService,
    private dialogRef: MatDialogRef<LoginDialogComponent>
  ) {}

  async loginWithEmail() {
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password';
      return;
    }

    this.loading = true;
    this.error = '';

    const result: AuthResult = await this.auth.loginWithEmail(
      this.email,
      this.password
    );

    this.loading = false;

    if (result.success) {
      this.dialogRef.close(result.user);
    } else {
      this.error = result.message || 'Login failed';
    }
  }

  async loginWithGoogle() {
    this.loading = true;
    this.error = '';

    const result: AuthResult = await this.auth.loginWithGoogle();

    this.loading = false;

    if (result.success) {
      this.dialogRef.close(result.user);
    } else {
      this.error = result.message || 'Google login failed';
    }
  }

  async loginWithGitHub() {
    this.loading = true;
    this.error = '';

    const result: AuthResult = await this.auth.loginWithGitHub();

    this.loading = false;

    if (result.success) {
      this.dialogRef.close(result.user);
    } else {
      this.error = result.message || 'GitHub login failed';
    }
  }

  async register() {
    if (!this.email || !this.password || !this.displayName) {
      this.error = 'Please fill all fields';
      return;
    }

    this.loading = true;
    this.error = '';

    const result: AuthResult = await this.auth.register(
      this.email,
      this.password,
      this.displayName
    );

    this.loading = false;

    if (result.success) {
      this.dialogRef.close(result.user);
      if (result.message) {
        // Show email verification message
        alert(result.message);
      }
    } else {
      this.error = result.message || 'Registration failed';
    }
  }

  switchMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error = '';
  }
}
```

### Template

```html
<!-- login-dialog.component.html -->
<div class="login-dialog">
  <h2>{{ mode === 'login' ? 'Sign In' : 'Create Account' }}</h2>

  <!-- Error message -->
  <div *ngIf="error" class="error-message">
    {{ error }}
  </div>

  <!-- Email/Password form -->
  <form *ngIf="config.allowEmail" (ngSubmit)="mode === 'login' ? loginWithEmail() : register()">
    <input
      type="email"
      [(ngModel)]="email"
      name="email"
      placeholder="Email"
      [disabled]="loading"
      required
    />

    <input
      type="password"
      [(ngModel)]="password"
      name="password"
      placeholder="Password"
      [disabled]="loading"
      required
    />

    <input
      *ngIf="mode === 'register'"
      type="text"
      [(ngModel)]="displayName"
      name="displayName"
      placeholder="Display Name"
      [disabled]="loading"
      required
    />

    <button type="submit" [disabled]="loading">
      {{ loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account') }}
    </button>
  </form>

  <!-- Divider -->
  <div *ngIf="config.allowEmail && (config.allowGoogle || config.allowGitHub)" class="divider">
    <span>OR</span>
  </div>

  <!-- Social login buttons -->
  <div class="social-buttons">
    <button
      *ngIf="config.allowGoogle"
      (click)="loginWithGoogle()"
      [disabled]="loading"
      class="google-btn"
    >
      <img src="assets/google-icon.svg" alt="Google" />
      Continue with Google
    </button>

    <button
      *ngIf="config.allowGitHub"
      (click)="loginWithGitHub()"
      [disabled]="loading"
      class="github-btn"
    >
      <img src="assets/github-icon.svg" alt="GitHub" />
      Continue with GitHub
    </button>
  </div>

  <!-- Switch mode link -->
  <div *ngIf="config.showRegister" class="switch-mode">
    <a (click)="switchMode()">
      {{ mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in' }}
    </a>
  </div>
</div>
```

---

## Usage in Application

### 1. App Initialization

```typescript
// app.component.ts
export class AppComponent implements OnInit {
  user$ = this.auth.user$;

  constructor(
    private auth: AuthService,
    private dialog: MatDialog
  ) {}

  async ngOnInit() {
    // Check for existing session
    const authenticated = await this.auth.checkSession();

    if (!authenticated && this.requiresAuth()) {
      this.openLoginDialog();
    }
  }

  openLoginDialog() {
    this.dialog.open(LoginDialogComponent, {
      width: '400px',
      disableClose: true // Require login
    });
  }

  private requiresAuth(): boolean {
    // Check if current route requires auth
    return !['/', '/about', '/pricing'].includes(window.location.pathname);
  }
}
```

### 2. Component Template

```html
<!-- app.component.html -->
<div class="app">
  <!-- Header with user menu -->
  <header>
    <div *ngIf="user$ | async as user; else loginButton">
      <span>{{ user.display_name }}</span>
      <img [src]="user.photo_url" alt="Profile" />
      <button (click)="signout()">Sign Out</button>
    </div>

    <ng-template #loginButton>
      <button (click)="openLoginDialog()">Sign In</button>
    </ng-template>
  </header>

  <!-- Main content -->
  <router-outlet></router-outlet>
</div>
```

### 3. Auth Guard

```typescript
// auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';
import { MatDialog } from '@angular/material/dialog';
import { LoginDialogComponent } from './components/login-dialog/login-dialog.component';

export const authGuard = () => {
  const auth = inject(AuthService);
  const dialog = inject(MatDialog);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Open login dialog instead of redirecting
  dialog.open(LoginDialogComponent, {
    width: '400px',
    disableClose: true
  }).afterClosed().subscribe(() => {
    // User logged in, navigation will proceed
  });

  return false;
};
```

---

## Accounts Platform API Endpoints

### POST /api/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "platform": "progalaxy"
}
```

**Response (Success):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 123,
    "email": "user@example.com",
    "display_name": "John Doe",
    "photo_url": null,
    "is_email_verified": true
  }
}

Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict
Set-Cookie: csrf_token=...; Secure; SameSite=Strict
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### GET /oauth/{provider}?platform=progalaxy&mode=popup

**OAuth Flow for Popup:**

1. Accounts platform redirects to OAuth provider
2. User authorizes
3. OAuth provider redirects back to accounts platform
4. Accounts platform generates tokens
5. Accounts platform renders a small HTML page:

```html
<!DOCTYPE html>
<html>
<head><title>Login Successful</title></head>
<body>
  <script>
    window.opener.postMessage({
      type: 'oauth_success',
      access_token: '<jwt>',
      user: {
        user_id: 123,
        email: 'user@example.com',
        display_name: 'John Doe',
        photo_url: 'https://...'
      }
    }, 'https://progalaxy.in');

    window.close();
  </script>
</body>
</html>
```

---

## Configuration

### Environment

```typescript
export const environment = {
  production: false,
  platformCode: 'progalaxy',
  accountsUrl: 'https://accounts.progalaxyelabs.com',
  apiServer: { host: 'http://localhost:3041/' },
  auth: {
    mode: 'cookie',
    refreshEndpoint: '/api/auth/refresh',
    useCsrf: true
  }
};
```

### Login Dialog Config (Optional Injectable)

```typescript
export interface LoginDialogConfig {
  allowEmail: boolean;
  allowGoogle: boolean;
  allowGitHub: boolean;
  showRegister: boolean;
}

export const LOGIN_CONFIG = new InjectionToken<LoginDialogConfig>('LOGIN_CONFIG');

// In app.config.ts
{
  provide: LOGIN_CONFIG,
  useValue: {
    allowEmail: true,
    allowGoogle: true,
    allowGitHub: false, // Disable GitHub login
    showRegister: true
  }
}
```

---

## Benefits

1. **No Page Redirect**: Users stay on your application
2. **Better UX**: Modal dialog feels more native
3. **Customizable**: Platforms control which login methods to show
4. **Observable State**: Components react to `auth.user$` changes
5. **OAuth in Popup**: Social login opens in small popup window
6. **Centralized Backend**: All auth handled by accounts platform API
7. **Type Safe**: Full TypeScript types for AuthResult, User, etc.

---

## Migration from Redirect-Based

**Before (Redirect):**
```typescript
signin() {
  this.auth.redirectToLogin('/dashboard');
}
```

**After (Modal):**
```typescript
signin() {
  this.dialog.open(LoginDialogComponent).afterClosed().subscribe(user => {
    if (user) {
      this.router.navigate(['/dashboard']);
    }
  });
}
```

---

**Document Status:** Enhanced Specification
**Implementation:** Phase 2 (after basic AuthService)
**Target Version:** ngx-stonescriptphp-client 2.1.0
