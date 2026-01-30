# Multi-Auth Server Support

## Overview

The ngx-stonescriptphp-client library now supports authenticating against multiple authentication servers. This enables platforms to accept logins from different identity providers (customer auth vs employee auth) within a single Angular application.

## Use Case

**Shared platforms** (like admin dashboards) often need to support authentication from multiple sources:

- **Customer authentication**: Users authenticating via the customer-facing auth server (`progalaxyelabs-auth`)
- **Employee authentication**: Internal staff authenticating via the employee auth server (`pel-admin-auth`)

This feature eliminates the need to maintain separate applications or complex proxy setups.

## Open-Source Benefit

Multi-tenant authentication with multiple identity providers is a differentiating feature that sets this library apart from single-server authentication libraries.

## Configuration

### Single-Server Mode (Backward Compatible)

The traditional single-server configuration continues to work:

```typescript
// environment.ts
export const environment = {
  production: false,
  platformCode: 'myapp',
  accountsUrl: 'https://accounts.progalaxyelabs.com',
  // ... other config
};
```

### Multi-Server Mode (New)

Configure multiple authentication servers with roles:

```typescript
// environment.ts
import { MyEnvironmentModel, AuthServerConfig } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const environment: MyEnvironmentModel = {
  production: false,
  platformCode: 'myapp',

  // Define multiple auth servers
  authServers: {
    customer: {
      url: 'https://auth.progalaxyelabs.com',
      default: true  // This server will be used by default
    },
    employee: {
      url: 'https://admin-auth.progalaxyelabs.com',
      jwksEndpoint: '/api/auth/jwks'  // Optional custom JWKS endpoint
    }
  },

  // ... other config
};
```

**Configuration Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `url` | `string` | Yes | Base URL of the authentication server |
| `jwksEndpoint` | `string` | No | JWKS endpoint for token validation (defaults to `/api/auth/jwks`) |
| `default` | `boolean` | No | Mark this server as the default (first server is used if none marked) |

## Usage

### Using the Default Server

All authentication methods work as before - they'll use the default server automatically:

```typescript
import { AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({...})
export class LoginComponent {
  constructor(private auth: AuthService) {}

  async login() {
    // Uses the default auth server (customer)
    const result = await this.auth.loginWithEmail('user@example.com', 'password');

    if (result.success) {
      console.log('Logged in as:', result.user);
    }
  }
}
```

### Switching Between Servers

Switch to a different auth server at runtime:

```typescript
import { AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({...})
export class LoginComponent {
  constructor(private auth: AuthService) {}

  async switchToEmployeeAuth() {
    // Switch to employee auth server
    this.auth.switchAuthServer('employee');

    console.log('Active server:', this.auth.getActiveAuthServer()); // 'employee'
  }

  async loginAsEmployee() {
    // After switching, all auth calls use the employee server
    const result = await this.auth.loginWithEmail('admin@company.com', 'password');

    if (result.success) {
      console.log('Employee logged in:', result.user);
    }
  }
}
```

### Specifying Server Per Request

Alternatively, specify the server for individual auth calls without switching:

```typescript
import { AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({...})
export class LoginComponent {
  constructor(private auth: AuthService) {}

  async loginCustomer() {
    // Login to customer auth server
    const result = await this.auth.loginWithEmail(
      'customer@example.com',
      'password',
      'customer'  // Server name
    );

    console.log('Customer logged in:', result.user);
  }

  async loginEmployee() {
    // Login to employee auth server
    const result = await this.auth.loginWithEmail(
      'admin@company.com',
      'password',
      'employee'  // Server name
    );

    console.log('Employee logged in:', result.user);
  }
}
```

### Dynamic Server Selection

Build a UI that lets users choose their authentication method:

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-multi-auth-login',
  template: `
    <div class="login-container">
      <h2>Login</h2>

      <!-- Server selection -->
      <div class="server-selection">
        <label>Login as:</label>
        <select [(ngModel)]="selectedServer">
          <option *ngFor="let server of availableServers" [value]="server">
            {{ server | titlecase }}
          </option>
        </select>
      </div>

      <!-- Login form -->
      <form (submit)="onLogin()">
        <input [(ngModel)]="email" placeholder="Email" type="email" required>
        <input [(ngModel)]="password" placeholder="Password" type="password" required>
        <button type="submit">Login</button>
      </form>

      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `
})
export class MultiAuthLoginComponent {
  email = '';
  password = '';
  error = '';
  selectedServer = 'customer';
  availableServers: string[] = [];

  constructor(private auth: AuthService) {
    // Get list of available auth servers
    this.availableServers = this.auth.getAvailableAuthServers();

    // Set default selection
    this.selectedServer = this.auth.getActiveAuthServer() || this.availableServers[0];
  }

  async onLogin() {
    const result = await this.auth.loginWithEmail(
      this.email,
      this.password,
      this.selectedServer
    );

    if (!result.success) {
      this.error = result.message || 'Login failed';
    } else {
      console.log('Logged in successfully:', result.user);
      // Navigate to dashboard, etc.
    }
  }
}
```

## API Reference

### Configuration Types

```typescript
interface AuthServerConfig {
  url: string;              // Server URL
  jwksEndpoint?: string;    // Optional JWKS endpoint
  default?: boolean;        // Mark as default server
}
```

### AuthService Methods

#### Multi-Server Management

```typescript
// Get list of configured auth servers
getAvailableAuthServers(): string[]

// Get current active auth server name
getActiveAuthServer(): string | null

// Switch to a different auth server
switchAuthServer(serverName: string): void

// Get auth server configuration
getAuthServerConfig(serverName?: string): AuthServerConfig | null

// Check if multi-server mode is enabled
isMultiServerMode(): boolean
```

#### Authentication Methods (with optional serverName parameter)

All authentication methods now accept an optional `serverName` parameter:

```typescript
// Email/Password
loginWithEmail(email: string, password: string, serverName?: string): Promise<AuthResult>
register(email: string, password: string, displayName: string, serverName?: string): Promise<AuthResult>

// OAuth Providers
loginWithGoogle(serverName?: string): Promise<AuthResult>
loginWithLinkedIn(serverName?: string): Promise<AuthResult>
loginWithApple(serverName?: string): Promise<AuthResult>
loginWithMicrosoft(serverName?: string): Promise<AuthResult>
loginWithGitHub(serverName?: string): Promise<AuthResult>
loginWithZoho(serverName?: string): Promise<AuthResult>

// Generic provider login
loginWithProvider(provider: AuthProvider, serverName?: string): Promise<AuthResult>

// Session management
checkSession(serverName?: string): Promise<boolean>
signout(serverName?: string): Promise<void>

// Multi-tenant methods
getTenantMemberships(serverName?: string): Promise<{...}>
selectTenant(tenantId: string, serverName?: string): Promise<{...}>
checkTenantSlugAvailable(slug: string, serverName?: string): Promise<{...}>
```

## Advanced Patterns

### Persisting Server Selection

The library automatically persists the active auth server to `localStorage`. When the user returns, their last selected server will be active:

```typescript
constructor(private auth: AuthService) {
  // Automatically restored from localStorage
  console.log('Active server:', this.auth.getActiveAuthServer());
}
```

### Server-Specific Routing

Route users to different pages based on their auth server:

```typescript
async onLogin() {
  const result = await this.auth.loginWithEmail(
    this.email,
    this.password,
    this.selectedServer
  );

  if (result.success) {
    const activeServer = this.auth.getActiveAuthServer();

    if (activeServer === 'customer') {
      this.router.navigate(['/customer-dashboard']);
    } else if (activeServer === 'employee') {
      this.router.navigate(['/admin-dashboard']);
    }
  }
}
```

### Detecting Multi-Server Mode

Conditionally show server selection UI only when multi-server is configured:

```typescript
@Component({...})
export class LoginComponent {
  showServerSelector = false;

  constructor(private auth: AuthService) {
    this.showServerSelector = this.auth.isMultiServerMode();
  }
}
```

## Backend Requirements

Each auth server must:

1. **Support the same platform code**: All servers should recognize the `platformCode` from your environment config
2. **Provide JWKS endpoint**: For JWT token validation (defaults to `/api/auth/jwks`)
3. **Support OAuth providers**: Each server should have the OAuth providers you need configured
4. **Handle cookies/CSRF**: If using cookie-based auth mode, ensure proper CORS and cookie settings

## Migration Guide

### From Single-Server to Multi-Server

1. **Update environment config**:

```typescript
// Before
export const environment = {
  accountsUrl: 'https://accounts.progalaxyelabs.com',
  // ...
};

// After
export const environment = {
  authServers: {
    main: {
      url: 'https://accounts.progalaxyelabs.com',
      default: true
    }
  },
  // ...
};
```

2. **No code changes required**: All existing authentication calls continue to work. The default server will be used automatically.

3. **Add additional servers as needed**:

```typescript
export const environment = {
  authServers: {
    main: {
      url: 'https://accounts.progalaxyelabs.com',
      default: true
    },
    admin: {
      url: 'https://admin-auth.progalaxyelabs.com'
    }
  },
  // ...
};
```

## Security Considerations

1. **Token Isolation**: Tokens from different auth servers are managed separately in the library
2. **Origin Validation**: OAuth popup messages are validated against the respective server's origin
3. **JWKS Validation**: Each server has its own JWKS endpoint for token signature validation
4. **Cookie Domains**: Ensure auth servers set cookies with appropriate domain restrictions

## Examples

### Full Multi-Auth Login Component

See the dynamic server selection example above for a complete implementation.

### Hybrid Auth Dashboard

Admin dashboard that accepts both customer and employee logins:

```typescript
// environment.ts
export const environment = {
  platformCode: 'admin-dashboard',
  authServers: {
    customer: {
      url: 'https://auth.progalaxyelabs.com',
      default: true
    },
    employee: {
      url: 'https://staff-auth.company.com'
    }
  }
};

// app.component.ts
@Component({...})
export class AppComponent {
  constructor(private auth: AuthService) {
    this.checkSession();
  }

  async checkSession() {
    // Try to restore session from either server
    const servers = this.auth.getAvailableAuthServers();

    for (const server of servers) {
      const hasSession = await this.auth.checkSession(server);
      if (hasSession) {
        console.log(`Session restored from ${server}`);
        this.auth.switchAuthServer(server);
        return;
      }
    }

    // No active session found
    this.router.navigate(['/login']);
  }
}
```

## Troubleshooting

### "Auth server 'xyz' not found in configuration"

Ensure the server name passed to methods matches the keys in your `authServers` config.

### "No authentication server configured"

You must set either `accountsUrl` (single-server) or `authServers` (multi-server) in your environment config.

### OAuth popup blocked

Ensure popup blockers are disabled. The library will return an error message if the popup is blocked.

### CORS issues with multiple servers

Each auth server must have proper CORS configuration to accept requests from your Angular app's domain.

## Open-Source Contribution

This feature is part of our commitment to making ngx-stonescriptphp-client the most flexible authentication library for Angular. Contributions, issues, and feature requests are welcome at [GitHub](https://github.com/progalaxyelabs/ngx-stonescriptphp-client).
