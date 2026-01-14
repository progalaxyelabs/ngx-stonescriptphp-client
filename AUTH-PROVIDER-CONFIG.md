# Authentication Provider Configuration Guide

## Overview

The ngx-stonescriptphp-client library supports declarative configuration of authentication providers. Platforms can specify which login methods to offer (Google, LinkedIn, Apple, Microsoft, GitHub, Email/Password) in any combination.

## Supported Providers

| Provider | Type | Description |
|----------|------|-------------|
| `google` | OAuth | Sign in with Google |
| `linkedin` | OAuth | Sign in with LinkedIn |
| `apple` | OAuth | Sign in with Apple |
| `microsoft` | OAuth | Sign in with Microsoft (Azure AD) |
| `github` | OAuth | Sign in with GitHub |
| `emailPassword` | Credentials | Traditional email/password login |

## Environment Configuration

### Basic Setup (All Providers Enabled)

If you don't specify `authProviders`, all providers are enabled by default:

```typescript
// environment.ts
export const environment = {
  production: false,
  platformCode: 'myapp',
  accountsUrl: 'https://accounts.progalaxyelabs.com',
  // ... other config
};
```

### Selective Provider Configuration

Specify which providers to enable and customize their labels:

```typescript
// environment.ts
import type { AuthProvider, ProviderConfig } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const environment = {
  production: false,
  platformCode: 'myapp',
  accountsUrl: 'https://accounts.progalaxyelabs.com',

  authProviders: {
    google: {
      label: 'Sign in with Google',
      icon: 'google-icon',
      enabled: true
    },
    linkedin: {
      label: 'Sign in with LinkedIn',
      icon: 'linkedin-icon',
      enabled: true
    },
    emailPassword: {
      label: 'Sign in with Email',
      icon: 'email-icon',
      enabled: true
    },
    // Disabled providers
    apple: {
      label: 'Sign in with Apple',
      enabled: false
    },
    microsoft: {
      label: 'Sign in with Microsoft',
      enabled: false
    },
    github: {
      label: 'Sign in with GitHub',
      enabled: false
    }
  } as Record<AuthProvider, ProviderConfig>,

  // ... other config
};
```

## Usage in Login Component

### Dynamic Provider Rendering

```typescript
// login-dialog.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService, AuthProvider } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-login-dialog',
  template: `
    <div class="login-dialog">
      <h2>Sign In</h2>

      <!-- Email/Password Form (if enabled) -->
      <form *ngIf="isProviderEnabled('emailPassword')" (submit)="onEmailLogin()">
        <input [(ngModel)]="email" placeholder="Email" type="email" required>
        <input [(ngModel)]="password" placeholder="Password" type="password" required>
        <button type="submit">{{ getProviderLabel('emailPassword') }}</button>
      </form>

      <!-- OAuth Providers -->
      <div class="oauth-buttons">
        <button
          *ngFor="let provider of oauthProviders"
          (click)="onOAuthLogin(provider)"
          class="oauth-btn"
        >
          <img [src]="getProviderIcon(provider)" *ngIf="getProviderIcon(provider)">
          {{ getProviderLabel(provider) }}
        </button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `
})
export class LoginDialogComponent implements OnInit {
  email = '';
  password = '';
  error = '';

  oauthProviders: AuthProvider[] = [];

  constructor(private auth: AuthService) {}

  ngOnInit() {
    // Get all available OAuth providers (excluding emailPassword)
    this.oauthProviders = this.auth.getAvailableProviders()
      .filter(p => p !== 'emailPassword');
  }

  isProviderEnabled(provider: AuthProvider): boolean {
    return this.auth.isProviderEnabled(provider);
  }

  getProviderLabel(provider: AuthProvider): string {
    return this.auth.getProviderConfig(provider)?.label || `Sign in with ${provider}`;
  }

  getProviderIcon(provider: AuthProvider): string | undefined {
    return this.auth.getProviderConfig(provider)?.icon;
  }

  async onEmailLogin() {
    const result = await this.auth.loginWithEmail(this.email, this.password);
    if (!result.success) {
      this.error = result.message || 'Login failed';
    }
  }

  async onOAuthLogin(provider: AuthProvider) {
    const result = await this.auth.loginWithProvider(provider);
    if (!result.success) {
      this.error = result.message || 'OAuth login failed';
    }
  }
}
```

### Manual Provider Selection

You can also call provider-specific methods directly:

```typescript
// Specific provider methods
await this.auth.loginWithGoogle();
await this.auth.loginWithLinkedIn();
await this.auth.loginWithApple();
await this.auth.loginWithMicrosoft();
await this.auth.loginWithGitHub();
await this.auth.loginWithEmail(email, password);

// Or use generic method
await this.auth.loginWithProvider('google');
await this.auth.loginWithProvider('linkedin');
```

## Example Configurations

### Professional Platform (Google, LinkedIn, Microsoft)

```typescript
authProviders: {
  google: { label: 'Google', enabled: true },
  linkedin: { label: 'LinkedIn', enabled: true },
  microsoft: { label: 'Microsoft', enabled: true },
  emailPassword: { label: 'Email', enabled: true },
  apple: { enabled: false },
  github: { enabled: false }
}
```

### Developer Platform (GitHub, Google, Email)

```typescript
authProviders: {
  github: { label: 'GitHub', enabled: true },
  google: { label: 'Google', enabled: true },
  emailPassword: { label: 'Email/Password', enabled: true },
  linkedin: { enabled: false },
  apple: { enabled: false },
  microsoft: { enabled: false }
}
```

### Consumer Platform (Google, Apple, Email)

```typescript
authProviders: {
  google: { label: 'Continue with Google', enabled: true },
  apple: { label: 'Continue with Apple', enabled: true },
  emailPassword: { label: 'Email', enabled: true },
  linkedin: { enabled: false },
  microsoft: { enabled: false },
  github: { enabled: false }
}
```

### Email-Only Platform

```typescript
authProviders: {
  emailPassword: { label: 'Sign In', enabled: true },
  google: { enabled: false },
  linkedin: { enabled: false },
  apple: { enabled: false },
  microsoft: { enabled: false },
  github: { enabled: false }
}
```

## Backend Setup

The accounts platform must support the OAuth providers you enable. Each provider requires:

1. **OAuth App Registration**: Register your app with the provider (Google Cloud Console, LinkedIn Developer Portal, etc.)
2. **Backend Route**: `/oauth/{provider}` endpoint that initiates OAuth flow
3. **Callback Handler**: Handles OAuth callback and returns access token via postMessage

Example backend routes needed:
- `/oauth/google` - Google OAuth
- `/oauth/linkedin` - LinkedIn OAuth
- `/oauth/apple` - Apple OAuth
- `/oauth/microsoft` - Microsoft OAuth
- `/oauth/github` - GitHub OAuth

See MODAL-AUTH-SPEC.md for complete backend requirements.

## API Reference

### AuthService Methods

```typescript
// Get available providers based on config
getAvailableProviders(): AuthProvider[]

// Check if specific provider is enabled
isProviderEnabled(provider: AuthProvider): boolean

// Get provider configuration
getProviderConfig(provider: AuthProvider): ProviderConfig | undefined

// Login with specific provider (OAuth only)
loginWithProvider(provider: AuthProvider): Promise<AuthResult>

// Provider-specific methods
loginWithGoogle(): Promise<AuthResult>
loginWithLinkedIn(): Promise<AuthResult>
loginWithApple(): Promise<AuthResult>
loginWithMicrosoft(): Promise<AuthResult>
loginWithGitHub(): Promise<AuthResult>
loginWithEmail(email: string, password: string): Promise<AuthResult>
```

### Types

```typescript
type AuthProvider = 'google' | 'linkedin' | 'apple' | 'microsoft' | 'github' | 'emailPassword';

interface ProviderConfig {
  label: string;        // Display name
  icon?: string;        // Icon identifier (platform-specific)
  enabled: boolean;     // Whether provider is enabled
}

interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
}
```

## Instagram Support

Instagram does offer OAuth login (`login.live.com/oauth20_authorize.srf`), but it's rarely used compared to other providers. If needed, you can add it to the library by:

1. Adding `'instagram'` to the `AuthProvider` type
2. Adding `loginWithInstagram()` method to AuthService
3. Configuring backend `/oauth/instagram` endpoint

However, most platforms prefer the current set of providers (Google, LinkedIn, Apple, Microsoft, GitHub) as they cover:
- **Professional**: LinkedIn, Microsoft
- **Consumer**: Google, Apple
- **Developer**: GitHub

## Migration from v1.x

If you're upgrading from v1.x where only Google/GitHub were supported:

```typescript
// Before (v1.x) - implicitly supported
await this.auth.loginWithGoogle();
await this.auth.loginWithGitHub();

// After (v2.0) - still works, plus new providers
await this.auth.loginWithGoogle();
await this.auth.loginWithGitHub();
await this.auth.loginWithLinkedIn();     // NEW
await this.auth.loginWithApple();        // NEW
await this.auth.loginWithMicrosoft();    // NEW

// Or use declarative config
const providers = this.auth.getAvailableProviders();
// ['google', 'linkedin', 'apple', 'microsoft', 'github', 'emailPassword']
```

No breaking changes - all existing code continues to work.
