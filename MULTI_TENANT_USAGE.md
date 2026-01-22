# Multi-Tenant Authentication - Usage Guide

**Version:** 1.3.0 (with multi-tenant support)
**Last Updated:** 2026-01-22

---

## Overview

The ngx-stonescriptphp-client library now supports **multi-tenant authentication** with both **embeddable** and **modal/dialog** patterns.

### Components Available

**Embeddable Components** (for custom layouts):
- `TenantRegisterComponent` - Tenant registration form
- `TenantLoginComponent` - Login with tenant selection

**Dialog/Modal Wrappers** (for popup overlays):
- `TenantRegisterDialogComponent` - Registration in a modal
- `TenantLoginDialogComponent` - Login in a modal

---

## Pattern 1: Embeddable Components

Use this pattern when you want full control over the page layout and want to embed the auth flow into your custom UI.

### Registration Example

```typescript
// signup.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TenantRegisterComponent, TenantCreatedEvent } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [TenantRegisterComponent],
  template: `
    <div class="signup-page">
      <div class="hero-section">
        <h1>Create Your Medical Store</h1>
        <p>Join thousands of medical stores using MedStoreApp</p>
      </div>

      <lib-tenant-register
        [providers]="['google']"
        [tenantNameLabel]="'Store Name'"
        [urlPreviewPrefix]="'medstoreapp.in/'"
        [ownershipMessage]="'You are creating a new medical store. If you are an employee, use Login instead - your owner will invite you.'"
        (tenantCreated)="onTenantCreated($event)"
        (navigateToLogin)="router.navigate(['/login'])">
      </lib-tenant-register>

      <div class="features">
        <div class="feature">
          <h3>✓ Easy to Use</h3>
          <p>Set up your store in minutes</p>
        </div>
        <div class="feature">
          <h3>✓ Powerful Features</h3>
          <p>Inventory, billing, reports & more</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .signup-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .hero-section {
      text-align: center;
      margin-bottom: 40px;
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 40px;
    }
  `]
})
export class SignupComponent {
  constructor(public router: Router) {}

  onTenantCreated(event: TenantCreatedEvent) {
    console.log('Tenant created:', event.tenant);
    console.log('User:', event.user);

    // AuthService automatically logs in the user
    // Redirect to onboarding or dashboard
    this.router.navigate(['/onboarding']);
  }
}
```

### Login Example

```typescript
// login.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TenantLoginComponent, TenantSelectedEvent } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [TenantLoginComponent],
  template: `
    <div class="login-page">
      <div class="branding">
        <img src="/assets/logo.png" alt="MedStoreApp">
        <h2>Welcome Back!</h2>
      </div>

      <lib-tenant-login
        [providers]="['google']"
        [showTenantSelector]="true"
        [autoSelectSingleTenant]="true"
        (tenantSelected)="onTenantSelected($event)"
        (createTenant)="router.navigate(['/signup'])">
      </lib-tenant-login>
    </div>
  `
})
export class LoginComponent {
  constructor(public router: Router) {}

  onTenantSelected(event: TenantSelectedEvent) {
    console.log('Selected tenant:', event.tenantSlug);
    console.log('User role:', event.role);

    // AuthService has set tenant context in JWT
    // Redirect to dashboard
    this.router.navigate(['/dashboard']);
  }
}
```

---

## Pattern 2: Dialog/Modal Components

Use this pattern for traditional web apps with a top navigation bar and "Sign Up" / "Login" buttons that open modals.

### With Angular Material Dialog

```typescript
// app.component.ts
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import {
  TenantRegisterDialogComponent,
  TenantLoginDialogComponent
} from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-root',
  template: `
    <nav>
      <div class="logo">MedStoreApp</div>
      <div class="nav-actions">
        <button (click)="openLoginDialog()">Login</button>
        <button (click)="openRegisterDialog()" class="primary">Sign Up</button>
      </div>
    </nav>

    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  constructor(
    private dialog: MatDialog,
    private router: Router
  ) {}

  openRegisterDialog() {
    const dialogRef = this.dialog.open(TenantRegisterDialogComponent, {
      width: '500px',
      disableClose: false,
      data: {
        providers: ['google'],
        tenantNameLabel: 'Store Name',
        urlPreviewPrefix: 'medstoreapp.in/',
        ownershipMessage: 'You are creating a new medical store. Employees should use Login instead.'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.tenant) {
        console.log('Tenant created:', result.tenant);
        this.router.navigate(['/dashboard']);
      } else if (result && result.action === 'navigate_to_login') {
        // User clicked "Already have an account? Sign in"
        this.openLoginDialog();
      }
    });
  }

  openLoginDialog() {
    const dialogRef = this.dialog.open(TenantLoginDialogComponent, {
      width: '450px',
      disableClose: false,
      data: {
        providers: ['google'],
        showTenantSelector: true,
        autoSelectSingleTenant: true
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.tenantId) {
        console.log('Logged in to tenant:', result.tenantSlug);
        this.router.navigate(['/dashboard']);
      } else if (result && result.action === 'create_tenant') {
        // User clicked "Create New Organization"
        this.openRegisterDialog();
      }
    });
  }
}
```

### With Custom Dialog Service

If you're not using Angular Material, you can use your own dialog service:

```typescript
// Using a custom dialog service
openRegisterDialog() {
  const dialog = this.customDialogService.open(TenantRegisterDialogComponent, {
    width: '500px',
    data: {
      providers: ['google'],
      tenantNameLabel: 'Store Name'
    }
  });

  dialog.onClose.subscribe(result => {
    if (result && result.tenant) {
      this.router.navigate(['/dashboard']);
    }
  });
}
```

---

## Pattern 3: Onboarding Flow (OAuth → Collect Store Name)

For a smoother UX, you can split the flow:
1. OAuth signup (just identity)
2. Onboarding form (collect store name)
3. Create tenant

```typescript
// Step 1: signup.component.ts - Just OAuth
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, AuthResult } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-signup',
  template: `
    <div class="signup-page">
      <h1>Create Your Account</h1>
      <button (click)="signupWithGoogle()" class="google-btn">
        Sign up with Google
      </button>
    </div>
  `
})
export class SignupComponent {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  async signupWithGoogle() {
    const result: AuthResult = await this.auth.loginWithGoogle();

    if (result.success) {
      // User authenticated, now collect tenant info
      this.router.navigate(['/onboarding']);
    } else {
      console.error('Signup failed:', result.message);
    }
  }
}
```

```typescript
// Step 2: onboarding.component.ts - Collect store info
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="onboarding">
      <h1>Set Up Your Medical Store</h1>

      <form (ngSubmit)="createStore()">
        <div class="form-group">
          <label>Store Name</label>
          <input [(ngModel)]="storeName" name="storeName" required>
        </div>

        <div class="form-group">
          <label>Store URL</label>
          <div class="url-input">
            <span>medstoreapp.in/</span>
            <input [(ngModel)]="storeSlug" name="storeSlug" required>
          </div>
        </div>

        <button type="submit" [disabled]="loading">
          {{ loading ? 'Creating...' : 'Create My Store' }}
        </button>
      </form>
    </div>
  `
})
export class OnboardingComponent {
  storeName = '';
  storeSlug = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  async createStore() {
    this.loading = true;

    const result = await this.auth.registerTenant({
      tenantName: this.storeName,
      tenantSlug: this.storeSlug,
      provider: 'emailPassword' // User already authenticated via OAuth
    });

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      console.error('Store creation failed:', result.message);
    }

    this.loading = false;
  }
}
```

---

## Component Input Options

### TenantRegisterComponent

```typescript
@Input() title: string = 'Create New Organization';
@Input() providers: AuthProvider[] = ['google'];
@Input() requireTenantName: boolean = true;

// Tenant section
@Input() tenantSectionTitle: string = 'Organization Information';
@Input() tenantNameLabel: string = 'Organization Name';
@Input() tenantNamePlaceholder: string = 'Enter your organization name';
@Input() tenantSlugLabel: string = 'Organization URL';
@Input() tenantSlugPlaceholder: string = 'organization-name';
@Input() urlPreviewEnabled: boolean = true;
@Input() urlPreviewPrefix: string = 'medstoreapp.in/';

// User section
@Input() userSectionTitle: string = 'Your Information';
@Input() oauthDescription: string = 'Recommended: Sign up with your Google account';

// Warning message
@Input() ownershipTitle: string = 'CREATING A NEW ORGANIZATION';
@Input() ownershipMessage: string = '...';

// Buttons
@Input() submitButtonText: string = 'Create Organization';
@Input() loginLinkText: string = 'Already have an account?';
@Input() loginLinkAction: string = 'Sign in';
```

### TenantLoginComponent

```typescript
@Input() title: string = 'Sign In';
@Input() providers: AuthProvider[] = ['google'];
@Input() showTenantSelector: boolean = true;
@Input() autoSelectSingleTenant: boolean = true;
@Input() allowTenantCreation: boolean = true;

// Tenant selector
@Input() tenantSelectorTitle: string = 'Select Organization';
@Input() tenantSelectorDescription: string = 'Choose which organization...';
@Input() continueButtonText: string = 'Continue';

// Links
@Input() registerLinkText: string = "Don't have an account?";
@Input() registerLinkAction: string = 'Sign up';
@Input() createTenantLinkText: string = "Don't see your organization?";
@Input() createTenantLinkAction: string = 'Create New Organization';
```

---

## Customization Examples

### Custom Branding

```typescript
<lib-tenant-register
  [title]="'Welcome to MedStoreApp'"
  [tenantNameLabel]="'Medical Store Name'"
  [urlPreviewPrefix]="'medstoreapp.in/stores/'"
  [ownershipMessage]="'Create your medical store account. Employees: Ask your store owner to invite you instead.'"
  [submitButtonText]="'Start My Free Trial'">
</lib-tenant-register>
```

### Multiple OAuth Providers

```typescript
<lib-tenant-login
  [providers]="['google', 'microsoft', 'emailPassword']"
  [title]="'Sign In to Your Account'">
</lib-tenant-login>
```

### Disable Tenant Selector (Single-Tenant Mode)

```typescript
<lib-tenant-login
  [showTenantSelector]="false"
  [providers]="['google']">
</lib-tenant-login>
```

---

## Events

### TenantRegisterComponent

```typescript
@Output() tenantCreated = new EventEmitter<TenantCreatedEvent>();
// TenantCreatedEvent: { tenant: {...}, user: {...} }

@Output() navigateToLogin = new EventEmitter<void>();
```

### TenantLoginComponent

```typescript
@Output() tenantSelected = new EventEmitter<TenantSelectedEvent>();
// TenantSelectedEvent: { tenantId: string, tenantSlug: string, role: string }

@Output() createTenant = new EventEmitter<void>();
```

---

## Styling

All components use scoped styles. You can override them using:

```scss
// In your global styles.scss
.tenant-register-dialog {
  .btn-primary {
    background-color: your-brand-color !important;
  }

  .warning-box {
    background: #fff8e1 !important;
    border-color: #ffa000 !important;
  }
}
```

---

## Backend Requirements

These components require the following API endpoints in your centralized auth service:

- `POST /api/auth/register-tenant` - Create tenant + user
- `GET /api/auth/memberships` - Get user's tenants
- `POST /api/auth/select-tenant` - Set tenant context
- `GET /api/auth/check-tenant-slug/:slug` - Validate slug

See `/ssd2/projects/progalaxy-elabs/.about/ngx-stonescriptphp-client/MULTI_TENANT_AUTH_SPEC.md` for full API specifications.

---

## Migration from Single-Tenant

If you're migrating from single-tenant authentication:

1. Replace `LoginDialogComponent` with `TenantLoginComponent`
2. Replace `RegisterComponent` with `TenantRegisterComponent`
3. Update API to support tenant context
4. Existing users will auto-select if they have one tenant

---

## Questions?

Contact: pradeepkumardesk@gmail.com
