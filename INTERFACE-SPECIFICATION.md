# ngx-stonescriptphp-client Interface Specification

**Version:** 2.0.0 (Draft)
**Library Version:** 1.1.2 → 2.0.0
**Last Updated:** 2026-01-14
**Status:** Specification Document

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Core Services](#core-services)
4. [Interface Contracts](#interface-contracts)
5. [Authentication Flows](#authentication-flows)
6. [Environment Configuration](#environment-configuration)
7. [Implementation Details](#implementation-details)
8. [Generated API Client Integration](#generated-api-client-integration)
9. [Migration Guide](#migration-guide)
10. [Testing Strategy](#testing-strategy)
11. [References](#references)

---

## Executive Summary

This document specifies how `ngx-stonescriptphp-client` (the Angular client library) interfaces with:

1. **Platform Frontends** (www, admin, hr, analytics) - Angular applications consuming the library
2. **Platform APIs** (api.progalaxy.in, etc.) - StoneScriptPHP backends providing CRUD operations
3. **Accounts Platform** (accounts.progalaxyelabs.com) - Centralized authentication service

The library provides a standardized interface for:
- Redirect-based authentication via centralized accounts platform
- Token management (access + refresh tokens)
- Automatic token refresh on expiration
- CSRF protection for cookie-based auth
- Type-safe API communication
- Multi-tenant support

---

## Architecture Overview

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Platform Frontend (Angular 20)                                 │
│  - progalaxy.in/www                                             │
│  - hr.progalaxyelabs.com/hr                                     │
│  - admin.progalaxyelabs.com/admin                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ngx-stonescriptphp-client                                 │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  AuthService                                         │  │ │
│  │  │  - redirectToLogin()                                 │  │ │
│  │  │  - handleLoginCallback()                             │  │ │
│  │  │  - signout()                                         │  │ │
│  │  │  - isAuthenticated()                                 │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  ApiConnectionService                                │  │ │
│  │  │  - get<T>(url, params)                               │  │ │
│  │  │  - post<T>(url, body)                                │  │ │
│  │  │  - put<T>(url, body)                                 │  │ │
│  │  │  - delete<T>(url)                                    │  │ │
│  │  │  - Auto-refresh on 401                               │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  TokenService                                        │  │ │
│  │  │  - setAccessToken()                                  │  │ │
│  │  │  - getAccessToken()                                  │  │ │
│  │  │  - hasValidAccessToken()                             │  │ │
│  │  │  - clear()                                           │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  SigninStatusService                                 │  │ │
│  │  │  - isSignedIn: Observable<boolean>                   │  │ │
│  │  │  - setSigninStatus()                                 │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  CsrfService                                         │  │ │
│  │  │  - getToken()                                        │  │ │
│  │  │  - setToken()                                        │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ 1. Redirect for login
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  Accounts Platform (accounts.progalaxyelabs.com)                │
│                                                                  │
│  - User registration & email verification                       │
│  - OAuth integration (Google, GitHub)                           │
│  - Password authentication                                      │
│  - JWT token generation (RS256)                                 │
│  - Refresh token rotation                                       │
│  - CSRF token generation                                        │
│                                                                  │
│  Returns: JWT + sets httpOnly cookies                           │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ 2. Callback with token
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  Platform Frontend (continued)                                  │
│  - Stores access token in memory                                │
│  - Makes API calls with Authorization header                    │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ 3. API requests with JWT
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  Platform API (StoneScriptPHP)                                  │
│  - api.progalaxy.in                                             │
│  - api.hr.progalaxyelabs.com                                    │
│                                                                  │
│  - Validates JWT signature                                      │
│  - Verifies platform & tenant                                   │
│  - Executes CRUD operations                                     │
│  - Returns ApiResponse<T>                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Services

### 1. AuthService

**Purpose:** Manages authentication flows with accounts platform

**Interface:**

```typescript
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { ApiConnectionService } from './api-connection.service';
import { MyEnvironmentModel } from './my-environment.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    private tokens: TokenService,
    private signinStatus: SigninStatusService,
    private apiConnection: ApiConnectionService,
    private environment: MyEnvironmentModel,
    private router: Router
  ) {}

  /**
   * Redirect user to accounts platform for login
   * @param returnUrl - URL to return to after successful login
   */
  redirectToLogin(returnUrl?: string): void {
    const accountsUrl = this.environment.accountsUrl;
    const platformCode = this.environment.platformCode;
    const returnPath = returnUrl || window.location.pathname + window.location.search;
    const currentOrigin = window.location.origin;

    const loginUrl = `${accountsUrl}/login?` +
      `platform=${platformCode}&` +
      `return=${encodeURIComponent(currentOrigin + returnPath)}`;

    window.location.href = loginUrl;
  }

  /**
   * Handle callback from accounts platform after login
   * Should be called from app component on init
   */
  handleLoginCallback(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      this.tokens.setAccessToken(token);
      this.signinStatus.setSigninStatus(true);

      // Remove token from URL for security
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens.hasValidAccessToken();
  }

  /**
   * Sign out user and clear tokens
   */
  async signout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate refresh token
      await this.apiConnection.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local tokens
      this.tokens.clear();
      this.signinStatus.setSigninStatus(false);

      // Redirect to login
      this.redirectToLogin('/');
    }
  }

  /**
   * Check for active session (used on app init)
   * Returns true if user has valid token or can refresh
   */
  async checkSession(): Promise<boolean> {
    // First check URL for callback token
    this.handleLoginCallback();

    // Check if we have a valid access token
    if (this.isAuthenticated()) {
      this.signinStatus.setSigninStatus(true);
      return true;
    }

    // Try to refresh using httpOnly cookie
    try {
      const refreshed = await this.refreshToken();
      this.signinStatus.setSigninStatus(refreshed);
      return refreshed;
    } catch (error) {
      this.signinStatus.setSigninStatus(false);
      return false;
    }
  }

  /**
   * Attempt to refresh access token using httpOnly refresh token cookie
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(
        this.environment.apiServer.host + this.environment.auth.refreshEndpoint,
        {
          method: 'POST',
          credentials: 'include' // Include httpOnly cookie
        }
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      if (data.access_token) {
        this.tokens.setAccessToken(data.access_token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }
}
```

**Usage in Platform Frontend:**

```typescript
// app.component.ts
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}

  async ngOnInit() {
    // Check for existing session or handle callback
    const authenticated = await this.auth.checkSession();

    if (!authenticated) {
      // Redirect to login if on protected route
      if (this.isProtectedRoute()) {
        this.auth.redirectToLogin();
      }
    }
  }
}

// signin.component.ts
export class SigninComponent {
  constructor(private auth: AuthService) {}

  signin() {
    this.auth.redirectToLogin('/dashboard');
  }
}
```

---

### 2. ApiConnectionService

**Purpose:** HTTP client for platform API communication with automatic token refresh

**Interface:**

```typescript
import { Injectable } from '@angular/core';
import { ApiResponse } from './api-response.model';
import { TokenService } from './token.service';
import { CsrfService } from './csrf.service';
import { MyEnvironmentModel } from './my-environment.model';

@Injectable({
  providedIn: 'root'
})
export class ApiConnectionService {

  private baseUrl: string;

  constructor(
    private tokens: TokenService,
    private csrf: CsrfService,
    private environment: MyEnvironmentModel
  ) {
    this.baseUrl = this.environment.apiServer.host;
  }

  /**
   * GET request
   */
  async get<T>(
    pathWithQueryParams: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    let url = this.baseUrl + pathWithQueryParams;

    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    return this.request<T>(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(
    pathWithQueryParams: string,
    body: unknown
  ): Promise<ApiResponse<T>> {
    const url = this.baseUrl + pathWithQueryParams;

    return this.request<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  /**
   * PUT request
   */
  async put<T>(
    pathWithQueryParams: string,
    body: unknown
  ): Promise<ApiResponse<T>> {
    const url = this.baseUrl + pathWithQueryParams;

    return this.request<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(
    pathWithQueryParams: string
  ): Promise<ApiResponse<T>> {
    const url = this.baseUrl + pathWithQueryParams;

    return this.request<T>(url, { method: 'DELETE' });
  }

  /**
   * Generic request handler with auto-refresh
   */
  private async request<T>(
    url: string,
    options: RequestInit
  ): Promise<ApiResponse<T>> {
    // Add Authorization header
    const token = this.tokens.getAccessToken();
    options.headers = {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Platform-Code': this.environment.platformCode
    };

    // Add CSRF token for state-changing operations
    if (this.environment.auth.useCsrf && ['POST', 'PUT', 'DELETE'].includes(options.method || '')) {
      const csrfToken = this.csrf.getToken();
      if (csrfToken) {
        options.headers[this.environment.auth.csrfHeaderName || 'X-CSRF-Token'] = csrfToken;
      }
    }

    // Include cookies for refresh token
    options.credentials = 'include';

    // Make request
    let response = await fetch(url, options);

    // Auto-refresh on 401 Unauthorized
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();

      if (refreshed) {
        // Retry with new token
        const newToken = this.tokens.getAccessToken();
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`
        };
        response = await fetch(url, options);
      } else {
        // Refresh failed - user needs to re-login
        // This will be handled by AuthGuard or app component
        return new ApiResponse<T>({
          success: false,
          message: 'Authentication required',
          data: null
        });
      }
    }

    // Parse response
    const data = await response.json();
    return new ApiResponse<T>(data);
  }

  /**
   * Refresh access token using httpOnly refresh token cookie
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(
        this.baseUrl + this.environment.auth.refreshEndpoint,
        {
          method: 'POST',
          credentials: 'include' // Include httpOnly refresh token cookie
        }
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      if (data.access_token) {
        this.tokens.setAccessToken(data.access_token);

        // Update CSRF token if provided
        if (data.csrf_token) {
          this.csrf.setToken(data.csrf_token);
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }
}
```

**Usage in Platform Frontend:**

```typescript
// submit-handler.service.ts (platform-specific)
export class SubmitHandlerService {
  constructor(
    private apiConnection: ApiConnectionService,
    private alert: AlertService
  ) {}

  async createProject(data: ProjectData): Promise<Project | null> {
    const response = await this.apiConnection.post<Project>(
      '/projects/create',
      data
    );

    let result: Project | null = null;

    response
      .onOk((project: Project) => {
        result = project;
      })
      .onNotOk((message: string) => {
        this.alert.show(message);
      })
      .onError(() => {
        this.alert.show('Server error. Please try again.');
      });

    return result;
  }
}
```

---

### 3. TokenService

**Purpose:** Manages access token in memory (XSS protection)

**Interface:**

```typescript
import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  exp: number;
  user_id: number;
  email: string;
  platform: string;
  tenant_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  private accessToken: string | null = null;

  /**
   * Set access token in memory
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if access token exists and is valid (not expired)
   */
  hasValidAccessToken(): boolean {
    if (!this.accessToken) {
      return false;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(this.accessToken);
      const now = Math.floor(Date.now() / 1000);

      // Check if token expires in more than 30 seconds
      return decoded.exp > (now + 30);
    } catch (error) {
      console.error('Invalid token format:', error);
      return false;
    }
  }

  /**
   * Get decoded token payload
   */
  getTokenPayload(): JwtPayload | null {
    if (!this.accessToken) {
      return null;
    }

    try {
      return jwtDecode<JwtPayload>(this.accessToken);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Clear all tokens
   */
  clear(): void {
    this.accessToken = null;
  }
}
```

---

### 4. SigninStatusService

**Purpose:** Observable signin status for UI updates

**Interface:**

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SigninStatusService {

  private signinStatusSubject = new BehaviorSubject<boolean>(false);

  /**
   * Observable signin status
   */
  public isSignedIn: Observable<boolean> = this.signinStatusSubject.asObservable();

  /**
   * Update signin status
   */
  setSigninStatus(status: boolean): void {
    this.signinStatusSubject.next(status);
  }

  /**
   * Get current signin status (non-observable)
   */
  getCurrentStatus(): boolean {
    return this.signinStatusSubject.value;
  }
}
```

**Usage in Platform Frontend:**

```typescript
// app.component.ts
export class AppComponent {
  isSignedIn$ = this.signinStatus.isSignedIn;

  constructor(private signinStatus: SigninStatusService) {}
}

// app.component.html
<div *ngIf="isSignedIn$ | async">
  <button (click)="signout()">Sign Out</button>
</div>
```

---

### 5. CsrfService

**Purpose:** Manages CSRF token for cookie-based auth

**Interface:**

```typescript
import { Injectable } from '@angular/core';
import { MyEnvironmentModel } from './my-environment.model';

@Injectable({
  providedIn: 'root'
})
export class CsrfService {

  private csrfToken: string | null = null;

  constructor(private environment: MyEnvironmentModel) {
    // Load CSRF token from cookie on init
    this.loadFromCookie();
  }

  /**
   * Get CSRF token
   */
  getToken(): string | null {
    return this.csrfToken;
  }

  /**
   * Set CSRF token
   */
  setToken(token: string): void {
    this.csrfToken = token;
  }

  /**
   * Load CSRF token from cookie
   */
  private loadFromCookie(): void {
    const cookieName = this.environment.auth.csrfTokenCookieName || 'csrf_token';
    const cookies = document.cookie.split(';');

    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === cookieName) {
        this.csrfToken = decodeURIComponent(value);
        break;
      }
    }
  }

  /**
   * Refresh CSRF token from cookie (call after login)
   */
  refresh(): void {
    this.loadFromCookie();
  }
}
```

---

## Interface Contracts

### Platform Frontend → ngx-client

**Required Configuration:**

```typescript
// environment.ts
export interface Environment {
  production: boolean;
  platformCode: string; // 'progalaxy', 'hr', 'admin', etc.
  accountsUrl: string; // 'https://accounts.progalaxyelabs.com'
  apiServer: {
    host: string; // 'http://localhost:3041/' or 'https://api.progalaxy.in/'
  };
  auth: {
    mode: 'cookie' | 'body' | 'none';
    refreshEndpoint: string; // '/auth/refresh'
    useCsrf: boolean;
    csrfTokenCookieName?: string; // default: 'csrf_token'
    csrfHeaderName?: string; // default: 'X-CSRF-Token'
  };
}
```

**Module Setup:**

```typescript
// app.config.ts
import { NgxStoneScriptPhpClientModule, MyEnvironmentModel } from '@progalaxyelabs/ngx-stonescriptphp-client';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    importProvidersFrom(NgxStoneScriptPhpClientModule),
    {
      provide: MyEnvironmentModel,
      useValue: environment
    }
  ]
};
```

---

### ngx-client → Accounts Platform

**Login Request (Redirect):**

```
GET https://accounts.progalaxyelabs.com/login?platform=progalaxy&return=https://progalaxy.in/dashboard
```

**Login Response (Redirect):**

```
302 Redirect to: https://progalaxy.in/dashboard?token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

Set-Cookie: refresh_token=<token_hash>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
Set-Cookie: csrf_token=<random_string>; Secure; SameSite=Strict; Max-Age=604800; Path=/
```

**Refresh Request:**

```
POST https://api.progalaxy.in/auth/refresh
Cookie: refresh_token=<token_hash>
```

**Refresh Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "csrf_token": "<new_csrf_token>"
}
```

**Logout Request:**

```
POST https://api.progalaxy.in/auth/logout
Cookie: refresh_token=<token_hash>
X-CSRF-Token: <csrf_token>
```

**Logout Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}

Set-Cookie: refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/
Set-Cookie: csrf_token=; Secure; SameSite=Strict; Max-Age=0; Path=/
```

---

### ngx-client → Platform API

**Typical API Request:**

```
POST https://api.progalaxy.in/projects/create
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
X-Platform-Code: progalaxy
X-CSRF-Token: <csrf_token>
Content-Type: application/json
Cookie: refresh_token=<token_hash>

{
  "name": "My Project",
  "description": "Project description"
}
```

**Successful Response:**

```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "project_id": 123,
    "name": "My Project",
    "description": "Project description",
    "created_at": "2026-01-14T12:00:00Z"
  }
}
```

**Error Response (Validation):**

```json
{
  "success": false,
  "message": "Project name is required",
  "data": null
}
```

**Error Response (Unauthorized):**

```
HTTP 401 Unauthorized

{
  "success": false,
  "message": "Invalid or expired token",
  "data": null
}
```

When receiving 401, ngx-client automatically attempts token refresh, then retries the original request.

---

## Authentication Flows

### Flow 1: First-Time Login

```
1. User visits https://progalaxy.in
2. AppComponent calls auth.checkSession()
3. No token found, no refresh token cookie
4. AuthGuard redirects to auth.redirectToLogin('/dashboard')
5. Browser navigates to: https://accounts.progalaxyelabs.com/login?platform=progalaxy&return=https://progalaxy.in/dashboard
6. User enters credentials on accounts platform
7. Accounts platform validates, issues tokens
8. Accounts platform redirects to: https://progalaxy.in/dashboard?token=<jwt>
   Sets cookies: refresh_token (httpOnly), csrf_token
9. AppComponent.ngOnInit() calls auth.handleLoginCallback()
10. Token extracted from URL, stored in memory via tokens.setAccessToken()
11. URL cleaned (token removed from query params)
12. signinStatus.setSigninStatus(true)
13. User sees dashboard
```

### Flow 2: Return Visit (Valid Refresh Token)

```
1. User visits https://progalaxy.in
2. AppComponent calls auth.checkSession()
3. No access token in memory
4. Attempts refresh: POST /auth/refresh with refresh_token cookie
5. Platform API validates refresh token, issues new access token
6. tokens.setAccessToken(newToken)
7. signinStatus.setSigninStatus(true)
8. User sees content without redirect
```

### Flow 3: API Call with Token Refresh

```
1. User clicks "Create Project"
2. Component calls apiConnection.post('/projects/create', data)
3. Request sent with Authorization: Bearer <token>
4. API returns 401 (token expired)
5. apiConnection automatically calls refreshAccessToken()
6. POST /auth/refresh with refresh_token cookie
7. New access token received and stored
8. Original request retried with new token
9. Project created successfully
10. User sees success message
```

### Flow 4: Cross-Platform SSO

```
1. User authenticated on progalaxy.in (has refresh_token cookie)
2. User clicks link to hr.progalaxyelabs.com
3. hr.progalaxyelabs.com AppComponent calls auth.checkSession()
4. No access token in memory
5. Attempts refresh: POST https://api.hr.progalaxyelabs.com/auth/refresh
6. Platform API validates refresh token
7. Checks platform_memberships table for user + 'hr' platform
8. Issues new JWT with platform=hr
9. User sees HR dashboard without re-login
```

---

## Environment Configuration

### Development Environment

```typescript
// www/src/environments/environment.ts
export const environment = {
  production: false,
  platformCode: 'progalaxy',
  accountsUrl: 'http://localhost:3040', // Local accounts platform
  apiServer: {
    host: 'http://localhost:3041/'
  },
  chatServer: {
    host: 'http://localhost:3043/'
  },
  uploadServer: {
    host: 'http://localhost:3044/'
  },
  auth: {
    mode: 'cookie' as 'cookie' | 'body' | 'none',
    refreshEndpoint: '/auth/refresh',
    useCsrf: true,
    csrfTokenCookieName: 'csrf_token',
    csrfHeaderName: 'X-CSRF-Token'
  }
};
```

### Production Environment

```typescript
// www/src/environments/environment.prod.ts
export const environment = {
  production: true,
  platformCode: 'progalaxy',
  accountsUrl: 'https://accounts.progalaxyelabs.com',
  apiServer: {
    host: 'https://api.progalaxy.in/'
  },
  chatServer: {
    host: 'https://chat.progalaxy.in/'
  },
  uploadServer: {
    host: 'https://upload.progalaxy.in/'
  },
  auth: {
    mode: 'cookie' as 'cookie' | 'body' | 'none',
    refreshEndpoint: '/auth/refresh',
    useCsrf: true,
    csrfTokenCookieName: 'csrf_token',
    csrfHeaderName: 'X-CSRF-Token'
  }
};
```

---

## Implementation Details

### Guards

**AuthGuard:**

```typescript
// auth.guard.ts (part of ngx-client)
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private auth: AuthService) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    const authenticated = await this.auth.checkSession();

    if (!authenticated) {
      this.auth.redirectToLogin(state.url);
      return false;
    }

    return true;
  }
}
```

**Usage:**

```typescript
// app.routes.ts
import { AuthGuard } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const routes: Routes = [
  { path: '', component: IntroComponent },
  { path: 'signin', component: SigninComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'projects', component: ProjectsComponent, canActivate: [AuthGuard] }
];
```

---

### ApiResponse Model

```typescript
// api-response.model.ts
export class ApiResponse<T> {

  private success: boolean;
  private message: string;
  private data: T | null;

  constructor(response: any) {
    this.success = response.success ?? false;
    this.message = response.message ?? '';
    this.data = response.data ?? null;
  }

  /**
   * Handle successful response
   */
  onOk(callback: (data: T) => void): this {
    if (this.success && this.data !== null) {
      callback(this.data);
    }
    return this;
  }

  /**
   * Handle error response
   */
  onNotOk(callback: (message: string) => void): this {
    if (!this.success) {
      callback(this.message);
    }
    return this;
  }

  /**
   * Handle network/server errors
   */
  onError(callback: () => void): this {
    if (!this.success && !this.message) {
      callback();
    }
    return this;
  }

  /**
   * Get raw data (for direct access)
   */
  getData(): T | null {
    return this.data;
  }

  /**
   * Check if response was successful
   */
  isSuccess(): boolean {
    return this.success;
  }

  /**
   * Get message
   */
  getMessage(): string {
    return this.message;
  }
}
```

---

## Generated API Client Integration

### Overview

The recommended development workflow uses a **generated API client** that wraps ngx-stonescriptphp-client for type-safe, endpoint-specific operations.

**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│  Angular Application                                │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Platform Services (ProjectService, etc.)      │ │
│  │  - Business logic                              │ │
│  │  - State management                            │ │
│  └─────────────────┬──────────────────────────────┘ │
│                    │                                 │
│                    ↓                                 │
│  ┌────────────────────────────────────────────────┐ │
│  │  Generated API Client (@myapi/client)          │ │
│  │  - Type-safe endpoints                         │ │
│  │  - Request/response models                     │ │
│  │  - Resource grouping (api.projects.create())   │ │
│  └─────────────────┬──────────────────────────────┘ │
│                    │                                 │
│                    ↓                                 │
│  ┌────────────────────────────────────────────────┐ │
│  │  ngx-stonescriptphp-client                     │ │
│  │  - ApiConnectionService                        │ │
│  │  - Auth, token management                      │ │
│  │  - Auto-refresh on 401                         │ │
│  │  - CSRF protection                             │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Developer Workflow

#### 1. Backend Development

```bash
# In API project
cd api

# Create route handler
php stone generate route create-project

# Define DTOs
# src/App/DTO/CreateProjectRequest.php
# src/App/DTO/CreateProjectResponse.php

# Implement route
# src/App/Routes/CreateProjectRoute.php

# Register in routes.php
# 'POST' => ['/projects/create' => CreateProjectRoute::class]

# Generate TypeScript client
php stone generate client --output=../portal/src/api-client
```

#### 2. Frontend Setup

```bash
# In Angular project
cd portal

# Install generated client (one-time)
npm install file:./src/api-client

# Setup in app.config.ts
```

```typescript
import { ApiClient } from '@myapi/client';
import { ApiConnectionService } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... ngx-client providers
    {
      provide: ApiClient,
      useFactory: (connection: ApiConnectionService) => new ApiClient(connection),
      deps: [ApiConnectionService]
    }
  ]
};
```

#### 3. Usage in Services

```typescript
// project.service.ts
import { Injectable } from '@angular/core';
import { ApiClient } from '@myapi/client';
import type { CreateProjectRequest, CreateProjectResponse } from '@myapi/client';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private api: ApiClient) {}

  async createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    try {
      // Type-safe API call
      // Auth, refresh, CSRF handled automatically
      return await this.api.projects.create(data);
    } catch (error) {
      console.error('Failed to create project:', error.message);
      throw error;
    }
  }

  async listProjects() {
    const response = await this.api.projects.list();
    return response.projects;
  }

  async updateProject(projectId: number, updates: Partial<CreateProjectRequest>) {
    return await this.api.projects.update({ project_id: projectId, ...updates });
  }

  async deleteProject(projectId: number) {
    await this.api.projects.delete(projectId);
  }
}
```

#### 4. Usage in Components

```typescript
// project-list.component.ts
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];
  loading = false;

  constructor(private projectService: ProjectService) {}

  async ngOnInit() {
    await this.loadProjects();
  }

  async loadProjects() {
    this.loading = true;
    try {
      this.projects = await this.projectService.listProjects();
    } catch (error) {
      // Handle error
    } finally {
      this.loading = false;
    }
  }

  async createNew() {
    const project = await this.projectService.createProject({
      name: 'New Project',
      description: 'Description'
    });

    this.projects = [...this.projects, project];
  }
}
```

### Benefits

1. **Type Safety**: Full TypeScript types from PHP DTOs
   ```typescript
   // TypeScript knows exact structure
   const data: CreateProjectRequest = {
     name: 'Project',       // ✅ string
     description: 'Desc',   // ✅ string
     start_date: null       // ✅ string | null
   };
   ```

2. **Auto-completion**: IDE suggests available endpoints
   ```typescript
   api.projects.  // IDE shows: create, list, update, delete
   ```

3. **Breaking Change Detection**: Compile errors when backend changes
   ```bash
   php stone generate client --output=../portal/src/api-client

   # TypeScript compiler shows:
   # Error: Property 'old_field' does not exist on CreateProjectRequest
   ```

4. **Separation of Concerns**:
   - **Generated client**: Endpoints, types, CRUD operations
   - **ngx-client**: HTTP transport, auth, refresh, CSRF
   - **Platform services**: Business logic, state management

5. **No Manual HTTP Code**: Never write `fetch()` or `HttpClient` calls
   ```typescript
   // ❌ Manual (error-prone, verbose)
   const response = await fetch('/projects/create', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'X-CSRF-Token': csrfToken,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(data)
   });

   // ✅ Generated (type-safe, concise)
   const project = await api.projects.create(data);
   ```

### Regenerating After Backend Changes

```bash
# 1. Update backend route/DTOs
# 2. Regenerate client
cd api && php stone generate client --output=../portal/src/api-client

# 3. Frontend automatically sees new types
# 4. TypeScript compiler catches breaking changes
# 5. Fix frontend code to match new types
# 6. No reinstall needed (file: protocol)
```

### Example: Full CRUD Flow

**Backend (PHP):**

```php
// routes.php
return [
    'GET' => [
        '/projects' => ListProjectsRoute::class,
        '/projects/{id}' => GetProjectRoute::class,
    ],
    'POST' => [
        '/projects/create' => CreateProjectRoute::class,
    ],
    'PUT' => [
        '/projects/{id}' => UpdateProjectRoute::class,
    ],
    'DELETE' => [
        '/projects/{id}' => DeleteProjectRoute::class,
    ],
];
```

**Generated Client:**

```typescript
export class ApiClient {
  constructor(private connection: ApiConnectionService) {}

  projects = {
    list: async (): Promise<ListProjectsResponse> => { ... },
    get: async (id: number): Promise<GetProjectResponse> => { ... },
    create: async (data: CreateProjectRequest): Promise<CreateProjectResponse> => { ... },
    update: async (data: UpdateProjectRequest): Promise<UpdateProjectResponse> => { ... },
    delete: async (id: number): Promise<void> => { ... }
  };
}
```

**Frontend Usage:**

```typescript
// List all
const { projects } = await api.projects.list();

// Get one
const project = await api.projects.get(123);

// Create
const newProject = await api.projects.create({
  name: 'My Project',
  description: 'Description'
});

// Update
await api.projects.update({
  project_id: 123,
  name: 'Updated Name'
});

// Delete
await api.projects.delete(123);
```

### Integration with ngx-client Services

The generated API client works seamlessly with ngx-client services:

**Authentication:**
```typescript
// Login handled by AuthService
await this.auth.redirectToLogin('/dashboard');

// After login, API client automatically uses tokens
const projects = await api.projects.list(); // ✅ Authenticated
```

**Token Refresh:**
```typescript
// Token expires during API call
const project = await api.projects.get(123);
// ↓ API returns 401
// ↓ ngx-client auto-refreshes token
// ↓ Retries request with new token
// ✅ Returns project data
```

**CSRF Protection:**
```typescript
// CSRF token automatically included
await api.projects.create(data);
// Request includes X-CSRF-Token header from cookie
```

**Error Handling:**
```typescript
try {
  await api.projects.create(data);
} catch (error) {
  // error.message = user-friendly message from backend
  console.error(error.message);
}
```

### Non-Angular Usage

The generated client works with React, Vue, or vanilla JS:

```typescript
// Standalone setup
import { ApiConnectionService, TokenService, CsrfService } from '@progalaxyelabs/ngx-stonescriptphp-client';
import { ApiClient } from '@myapi/client';

const environment = {
  apiServer: { host: 'http://localhost:9100' },
  platformCode: 'myapp',
  auth: { mode: 'cookie', refreshEndpoint: '/auth/refresh', useCsrf: true }
};

const tokens = new TokenService();
const csrf = new CsrfService(environment);
const connection = new ApiConnectionService(tokens, csrf, environment);
const api = new ApiClient(connection);

// Use it
const projects = await api.projects.list();
```

### Reference

For complete specification of the `php stone generate client` command, see:
- [GENERATE-API-CLIENT-SPEC.md](https://github.com/progalaxyelabs/StoneScriptPHP/blob/main/GENERATE-API-CLIENT-SPEC.md)

---

## Migration Guide

### Step 1: Update Environment Files

Add new fields to environment configuration:

```typescript
// Before
export const environment = {
  production: false,
  apiServer: { host: 'http://localhost:3041/' }
};

// After
export const environment = {
  production: false,
  platformCode: 'progalaxy',
  accountsUrl: 'http://localhost:3040',
  apiServer: { host: 'http://localhost:3041/' },
  auth: {
    mode: 'cookie',
    refreshEndpoint: '/auth/refresh',
    useCsrf: true
  }
};
```

### Step 2: Update app.config.ts

Provide environment to ngx-client:

```typescript
import { MyEnvironmentModel } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    {
      provide: MyEnvironmentModel,
      useValue: environment
    }
  ]
};
```

### Step 3: Remove Custom Auth Services

Delete platform-specific implementations:
- `auth.service.ts` (keep only if you have platform-specific methods)
- `api-connection.service.ts`
- `token.service.ts`
- `signin-status.service.ts`
- `db.service.ts` (if not used)

### Step 4: Update Imports

```typescript
// Before
import { AuthService } from './services/auth.service';
import { ApiConnectionService } from './services/api-connection.service';

// After
import { AuthService, ApiConnectionService } from '@progalaxyelabs/ngx-stonescriptphp-client';
```

### Step 5: Update AppComponent

```typescript
// app.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

  constructor(private auth: AuthService) {}

  async ngOnInit() {
    await this.auth.checkSession();
  }
}
```

### Step 6: Update Route Guards

```typescript
// app.routes.ts
import { AuthGuard } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] }
];
```

### Step 7: Update Sign-in Components

```typescript
// Before
signin() {
  this.auth.signinWithEmail(email, password).subscribe(...);
}

// After
signin() {
  this.auth.redirectToLogin('/dashboard');
}
```

### Step 8: Test Authentication Flow

1. Start accounts platform (port 3040)
2. Start platform API (port 3041)
3. Start platform frontend (port 4200)
4. Test login flow
5. Test token refresh
6. Test logout
7. Test cross-platform navigation

---

## Testing Strategy

### Unit Tests

**AuthService Tests:**

```typescript
describe('AuthService', () => {
  let service: AuthService;

  it('should redirect to accounts platform', () => {
    spyOn(window.location, 'href', 'set');
    service.redirectToLogin('/dashboard');
    expect(window.location.href).toContain('accounts.progalaxyelabs.com');
  });

  it('should handle login callback', () => {
    // Mock URL with token
    spyOn(window.history, 'replaceState');
    service.handleLoginCallback();
    expect(tokens.getAccessToken()).not.toBeNull();
  });
});
```

**ApiConnectionService Tests:**

```typescript
describe('ApiConnectionService', () => {
  it('should add Authorization header', async () => {
    spyOn(window, 'fetch');
    await service.get('/projects');
    expect(fetch).toHaveBeenCalledWith(
      jasmine.any(String),
      jasmine.objectContaining({
        headers: jasmine.objectContaining({
          'Authorization': jasmine.stringMatching(/Bearer/)
        })
      })
    );
  });

  it('should auto-refresh on 401', async () => {
    // Mock 401 response, then success
    spyOn(window, 'fetch').and.returnValues(
      Promise.resolve(new Response(null, { status: 401 })),
      Promise.resolve(new Response(JSON.stringify({ access_token: 'new' }))),
      Promise.resolve(new Response(JSON.stringify({ success: true })))
    );

    const response = await service.get('/projects');
    expect(fetch).toHaveBeenCalledTimes(3); // original + refresh + retry
  });
});
```

### Integration Tests

**E2E Login Flow:**

```typescript
describe('Login Flow', () => {
  it('should redirect to accounts and back', async () => {
    await page.goto('http://localhost:4200/dashboard');

    // Should redirect to accounts
    await page.waitForNavigation();
    expect(page.url()).toContain('accounts.progalaxyelabs.com');

    // Fill login form
    await page.type('[name="email"]', 'test@example.com');
    await page.type('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect back with token
    await page.waitForNavigation();
    expect(page.url()).toContain('localhost:4200/dashboard');
    expect(page.url()).toContain('?token=');

    // Token should be stored, URL cleaned
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('?token=');
  });
});
```

---

## References

- [Centralized Auth Framework](/.about/CENTRALIZED-AUTH-FRAMEWORK.md)
- [Platform Development Guide](/.about/PLATFORM-DEVELOPMENT-GUIDE.md)
- [StoneScriptPHP Documentation](https://stonescriptphp.org)
- [JWT Best Practices (RFC 8725)](https://www.rfc-editor.org/rfc/rfc8725.html)
- [OAuth 2.0 Framework (RFC 6749)](https://www.rfc-editor.org/rfc/rfc6749.html)

---

**Document Status:** Draft
**Target Version:** ngx-stonescriptphp-client 2.0.0
**Next Steps:**
1. Implement AuthService with redirect-based login
2. Update ApiConnectionService for auto-refresh
3. Implement AuthGuard
4. Update TypeScript interfaces
5. Write unit tests
6. Create migration scripts
7. Update README and CHANGELOG
8. Publish to npm

**Owner:** StoneScriptPHP Team
**Review Date:** 2026-02-01
