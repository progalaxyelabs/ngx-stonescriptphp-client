# LoginComponent

A comprehensive Angular login component with email/password authentication and OAuth support for the StoneScriptPHP client library.

## Features

- Email/password login form
- Google OAuth integration
- Multi-tenant support with tenant selection
- Comprehensive error handling with user-friendly messages
- Loading states and visual feedback
- Fully customizable via CSS variables
- Standalone component (no module required)
- Accessibility support (ARIA attributes)
- Responsive design

## Usage

### Basic Usage

```typescript
import { Component } from '@angular/core';
import { LoginComponent } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [LoginComponent],
  template: `
    <ngx-ssp-login
      [platformCode]="'my-platform'"
      [redirectUrl]="'/dashboard'"
      (loginSuccess)="onLoginSuccess($event)"
      (loginError)="onLoginError($event)">
    </ngx-ssp-login>
  `
})
export class AuthComponent {
  onLoginSuccess(response: any) {
    console.log('Login successful:', response);
  }

  onLoginError(error: any) {
    console.error('Login failed:', error);
  }
}
```

### With Tenant Selection

```typescript
import { Component } from '@angular/core';
import { LoginComponent } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [LoginComponent],
  template: `
    <ngx-ssp-login
      [platformCode]="'my-platform'"
      [redirectUrl]="'/dashboard'"
      (tenantSelectionRequired)="onTenantSelectionRequired($event)">
    </ngx-ssp-login>
  `
})
export class AuthComponent {
  onTenantSelectionRequired(data: { selectionToken: string, memberships: any[] }) {
    console.log('Tenant selection required:', data);
    // Show TenantPickerComponent here
  }
}
```

### With Direct Tenant Login

```typescript
<ngx-ssp-login
  [platformCode]="'my-platform'"
  [tenantSlug]="'acme-corp'"
  [redirectUrl]="'/dashboard'">
</ngx-ssp-login>
```

## Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `platformCode` | `string` | **Required** | Platform identifier for authentication |
| `tenantSlug` | `string` | `undefined` | Optional tenant slug for direct tenant login |
| `redirectUrl` | `string` | `'/'` | URL to navigate to after successful login |
| `showGoogleLogin` | `boolean` | `true` | Show/hide Google OAuth button |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `loginSuccess` | `EventEmitter<AuthResponse>` | Emitted when login succeeds with single tenant |
| `tenantSelectionRequired` | `EventEmitter<{ selectionToken: string, memberships: any[] }>` | Emitted when user has multiple tenants |
| `loginError` | `EventEmitter<LoginError>` | Emitted when login fails |

## Component States

The component manages the following states:

- `idle` - Initial state, ready for user input
- `loading` - Authentication in progress
- `error` - Authentication failed with error message
- `requiresTenantSelection` - User has multiple tenants, needs to select one

## Error Handling

The component provides user-friendly error messages for common scenarios:

- Invalid credentials (401)
- Access denied (403)
- Network errors (0)
- Server errors (5xx)
- Custom error messages from API

Example error object:

```typescript
interface LoginError {
  message: string;
  code?: string;
}
```

## Customization

### CSS Variables

The component can be fully customized using CSS variables:

```css
ngx-ssp-login {
  /* Card styling */
  --ngx-ssp-login-card-bg: #ffffff;
  --ngx-ssp-login-card-border-radius: 12px;
  --ngx-ssp-login-card-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* Primary button */
  --ngx-ssp-btn-primary-bg: #6366f1;
  --ngx-ssp-btn-primary-hover-bg: #4f46e5;

  /* Typography */
  --ngx-ssp-login-font-family: 'Inter', sans-serif;

  /* Form inputs */
  --ngx-ssp-form-input-border-radius: 8px;
  --ngx-ssp-form-input-focus-border: #6366f1;
}
```

### Available CSS Variables

See the component CSS file for a complete list of customizable variables including:

- Container and card styling
- Typography (fonts, sizes, weights, colors)
- Form elements (inputs, labels)
- Buttons (primary, Google OAuth)
- Error displays
- Loading spinners
- Dividers

### Custom Styling Example

```css
/* In your global styles or component styles */
.custom-login ngx-ssp-login {
  --ngx-ssp-login-card-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --ngx-ssp-login-title-color: #ffffff;
  --ngx-ssp-btn-primary-bg: #fbbf24;
  --ngx-ssp-btn-primary-color: #1f2937;
  --ngx-ssp-btn-primary-hover-bg: #f59e0b;
}
```

## Integration with TenantPickerComponent

When the component emits `tenantSelectionRequired`, you should display a TenantPickerComponent:

```typescript
import { Component } from '@angular/core';
import { LoginComponent, TenantPickerComponent } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [LoginComponent, TenantPickerComponent],
  template: `
    <ngx-ssp-login
      *ngIf="!showTenantPicker"
      [platformCode]="'my-platform'"
      (tenantSelectionRequired)="onTenantSelectionRequired($event)">
    </ngx-ssp-login>

    <ngx-ssp-tenant-picker
      *ngIf="showTenantPicker"
      [selectionToken]="selectionToken"
      [memberships]="availableTenants"
      (tenantSelected)="onTenantSelected($event)">
    </ngx-ssp-tenant-picker>
  `
})
export class AuthComponent {
  showTenantPicker = false;
  selectionToken = '';
  availableTenants: any[] = [];

  onTenantSelectionRequired(data: { selectionToken: string, memberships: any[] }) {
    this.selectionToken = data.selectionToken;
    this.availableTenants = data.memberships;
    this.showTenantPicker = true;
  }

  onTenantSelected(response: any) {
    console.log('Tenant selected:', response);
    this.showTenantPicker = false;
  }
}
```

## Accessibility

The component includes ARIA attributes for better accessibility:

- `role="alert"` on error messages
- `aria-live="polite"` for error announcements
- `aria-required="true"` on required inputs
- `aria-label` on icon buttons
- Proper focus management

## Responsive Design

The component is fully responsive with:

- Mobile-friendly layout
- Touch-optimized button sizes
- Adaptive padding and spacing
- Readable typography at all screen sizes

## Dependencies

- `@angular/core`
- `@angular/common`
- `@angular/forms`
- `@angular/router`
- `rxjs`

All dependencies are peer dependencies and should already be available in your Angular application.

## License

MIT
