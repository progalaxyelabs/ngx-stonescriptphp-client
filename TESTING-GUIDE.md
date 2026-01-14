# Testing Guide - ngx-stonescriptphp-client v2.0.0

## Testing Options

You have several ways to test the modal authentication components:

### Option 1: Quick Test in Existing Platform (Recommended)
Test directly in an existing platform (like progalaxy.in) that already uses this library.

### Option 2: Create Minimal Test App
Set up a minimal Angular app specifically for testing.

### Option 3: Unit Tests
Add comprehensive unit tests to the library itself.

---

## Option 1: Testing in Existing Platform

### Step 1: Build the Library

```bash
cd /ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptphp/ngx-stonescriptphp-client
npm run build
```

This creates the `dist/` folder with compiled library.

### Step 2: Link to Platform

In the platform project (e.g., progalaxy.in):

```bash
cd /path/to/progalaxy-platform
npm link /ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptphp/ngx-stonescriptphp-client/dist
```

Or update `package.json` to use local path:

```json
{
  "dependencies": {
    "@progalaxyelabs/ngx-stonescriptphp-client": "file:../../stonescriptphp/ngx-stonescriptphp-client/dist"
  }
}
```

### Step 3: Update Environment Configuration

Update `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  platformCode: 'progalaxy',
  accountsUrl: 'https://accounts.progalaxyelabs.com',  // or localhost for testing
  apiServer: {
    host: 'http://localhost:9100/'
  },
  auth: {
    mode: 'cookie',
    refreshEndpoint: '/auth/refresh',
    useCsrf: true
  }
};
```

### Step 4: Create Test Component

Create `src/app/test-auth.component.ts`:

```typescript
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LoginDialogComponent, AuthService } from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-test-auth',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 20px;">
      <h1>Authentication Test Page</h1>

      <button (click)="testGoogleEmail()" class="btn">
        Test: Google + Email
      </button>

      <button (click)="testEmailOnly()" class="btn">
        Test: Email Only
      </button>

      <button (click)="testAllProviders()" class="btn">
        Test: All Providers
      </button>

      <button (click)="testNoProviders()" class="btn" style="background: red;">
        Test: No Providers (Should Error)
      </button>

      <div style="margin-top: 20px;">
        <h3>Current User:</h3>
        <pre>{{ (auth.user$ | async) | json }}</pre>
      </div>

      <button (click)="signout()" *ngIf="auth.isAuthenticated()">
        Sign Out
      </button>
    </div>
  `,
  styles: [`
    .btn {
      display: block;
      margin: 10px 0;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn:hover {
      background: #0056b3;
    }
  `]
})
export class TestAuthComponent {
  constructor(
    private dialog: MatDialog,
    public auth: AuthService
  ) {}

  testGoogleEmail() {
    const dialogRef = this.dialog.open(LoginDialogComponent, {
      width: '400px',
      disableClose: true
    });
    dialogRef.componentInstance.providers = ['google', 'emailPassword'];
  }

  testEmailOnly() {
    const dialogRef = this.dialog.open(LoginDialogComponent, {
      width: '400px'
    });
    dialogRef.componentInstance.providers = ['emailPassword'];
  }

  testAllProviders() {
    const dialogRef = this.dialog.open(LoginDialogComponent, {
      width: '400px'
    });
    dialogRef.componentInstance.providers = [
      'google',
      'linkedin',
      'apple',
      'microsoft',
      'github',
      'emailPassword'
    ];
  }

  testNoProviders() {
    try {
      const dialogRef = this.dialog.open(LoginDialogComponent, {
        width: '400px'
      });
      // Intentionally NOT setting providers - should throw error
    } catch (error) {
      console.error('Expected error:', error);
      alert('Error caught: ' + error);
    }
  }

  async signout() {
    await this.auth.signout();
  }
}
```

### Step 5: Add Route

Update `app.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { TestAuthComponent } from './test-auth.component';

export const routes: Routes = [
  { path: 'test-auth', component: TestAuthComponent },
  // ... existing routes
];
```

### Step 6: Run Platform

```bash
npm start
# Navigate to http://localhost:4200/test-auth
```

### Step 7: Test Scenarios

1. **Test Google + Email**
   - Click "Test: Google + Email" button
   - Verify dialog shows email form and Google button
   - Try email login with test credentials
   - Try Google OAuth (opens popup)

2. **Test Email Only**
   - Click "Test: Email Only" button
   - Verify dialog shows only email form (no OAuth buttons)
   - Try login

3. **Test All Providers**
   - Click "Test: All Providers" button
   - Verify dialog shows email form + all 5 OAuth buttons
   - Check button styling and layout

4. **Test Error Handling**
   - Click "Test: No Providers (Should Error)" button
   - Verify error is thrown in console
   - Check if error message displays in dialog

5. **Test Authentication State**
   - After successful login, verify user object appears
   - Click "Sign Out" and verify user is cleared

---

## Option 2: Create Minimal Test App

### Step 1: Create New Angular App

```bash
cd /tmp
ng new auth-test-app --standalone --routing
cd auth-test-app
```

### Step 2: Install Dependencies

```bash
npm install @angular/material
npm install file:/ssd2/projects/progalaxy-elabs/divisions/opensource/stonescriptphp/ngx-stonescriptphp-client/dist
```

### Step 3: Setup App Module

Update `src/app/app.config.ts`:

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { NgxStoneScriptPhpClientModule, MyEnvironmentModel } from '@progalaxyelabs/ngx-stonescriptphp-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    NgxStoneScriptPhpClientModule.forRoot({
      production: false,
      platformCode: 'test',
      accountsUrl: 'http://localhost:8080',  // Mock backend
      apiServer: { host: 'http://localhost:8080/' },
      auth: {
        mode: 'cookie',
        refreshEndpoint: '/auth/refresh',
        useCsrf: true
      }
    } as MyEnvironmentModel)
  ]
};
```

### Step 4: Use the Test Component from Step 4 above

### Step 5: Create Mock Backend (Optional)

Create `mock-server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());

// Mock login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (email === 'test@test.com' && password === 'test123') {
    res.json({
      status: 'ok',
      message: 'Login successful',
      data: {
        access_token: 'mock_access_token_12345',
        user: {
          id: '1',
          email: 'test@test.com',
          display_name: 'Test User',
          role: 'student',
          is_email_verified: true
        }
      }
    });
  } else {
    res.status(401).json({
      status: 'error',
      message: 'Invalid credentials',
      data: null
    });
  }
});

// Mock OAuth endpoints
app.get('/oauth/:provider', (req, res) => {
  res.send(`
    <html>
      <script>
        window.opener.postMessage({
          status: 'ok',
          data: {
            access_token: 'mock_oauth_token',
            user: {
              id: '2',
              email: 'oauth@test.com',
              display_name: 'OAuth User',
              role: 'student',
              is_email_verified: true
            }
          }
        }, '*');
        window.close();
      </script>
    </html>
  `);
});

app.listen(8080, () => {
  console.log('Mock server running on http://localhost:8080');
});
```

Run mock server:

```bash
npm install express cors
node mock-server.js
```

---

## Option 3: Unit Tests

### Add Unit Tests to Library

Create `src/lib/components/login-dialog.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginDialogComponent } from './login-dialog.component';
import { AuthService } from '../../auth.service';
import { MyEnvironmentModel } from '../../my-environment.model';

describe('LoginDialogComponent', () => {
  let component: LoginDialogComponent;
  let fixture: ComponentFixture<LoginDialogComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['loginWithEmail', 'loginWithProvider']);

    await TestBed.configureTestingModule({
      imports: [LoginDialogComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        {
          provide: MyEnvironmentModel,
          useValue: {
            platformCode: 'test',
            accountsUrl: 'http://localhost:8080'
          }
        }
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    fixture = TestBed.createComponent(LoginDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should throw error when no providers specified', () => {
    component.providers = [];
    expect(() => component.ngOnInit()).toThrowError(/requires providers input/);
  });

  it('should accept valid providers', () => {
    component.providers = ['google', 'emailPassword'];
    expect(() => component.ngOnInit()).not.toThrow();
    expect(component.oauthProviders).toEqual(['google']);
  });

  it('should filter emailPassword from OAuth providers', () => {
    component.providers = ['google', 'linkedin', 'emailPassword'];
    component.ngOnInit();
    expect(component.oauthProviders).toEqual(['google', 'linkedin']);
  });

  it('should call AuthService on email login', async () => {
    component.providers = ['emailPassword'];
    component.ngOnInit();
    component.email = 'test@test.com';
    component.password = 'password';

    authService.loginWithEmail.and.returnValue(
      Promise.resolve({ success: true, user: {} as any })
    );

    await component.onEmailLogin();
    expect(authService.loginWithEmail).toHaveBeenCalledWith('test@test.com', 'password');
  });

  it('should show error on failed login', async () => {
    component.providers = ['emailPassword'];
    component.ngOnInit();
    component.email = 'test@test.com';
    component.password = 'wrong';

    authService.loginWithEmail.and.returnValue(
      Promise.resolve({ success: false, message: 'Invalid credentials' })
    );

    await component.onEmailLogin();
    expect(component.error).toBe('Invalid credentials');
  });
});
```

Run tests:

```bash
npm test
```

---

## Testing Checklist

### UI Testing
- [ ] Dialog opens correctly
- [ ] Providers render based on input array
- [ ] Email form validation works
- [ ] OAuth buttons styled correctly
- [ ] Loading states display properly
- [ ] Error messages show clearly
- [ ] Success messages display
- [ ] Dialog closes on successful login

### Functional Testing
- [ ] Email/password login works
- [ ] Google OAuth popup opens
- [ ] LinkedIn OAuth popup opens
- [ ] Apple OAuth popup opens
- [ ] Microsoft OAuth popup opens
- [ ] GitHub OAuth popup opens
- [ ] postMessage communication works
- [ ] User state updates after login
- [ ] Sign out clears user state
- [ ] Token refresh works on 401

### Error Handling
- [ ] Missing providers throws error
- [ ] Empty providers array throws error
- [ ] Invalid credentials show error
- [ ] Network errors handled gracefully
- [ ] Popup blocked warning displays

### Edge Cases
- [ ] Only emailPassword provider
- [ ] Only OAuth providers (no email)
- [ ] All providers enabled
- [ ] Dialog width customization
- [ ] disableClose option works
- [ ] Multiple dialog opens

---

## Debugging Tips

### Check Console for Errors

```javascript
// Browser console
localStorage.getItem('progalaxyapi_access_token')  // Check token
document.cookie  // Check cookies
```

### Enable Verbose Logging

Add to AuthService:

```typescript
async loginWithEmail(email: string, password: string): Promise<AuthResult> {
  console.log('[AuthService] loginWithEmail called', { email });

  try {
    const response = await this.apiConnection.post<{ access_token: string; user: User }>(
      `${this.accountsUrl}/api/auth/login`,
      { email, password, platform_code: this.platformCode }
    );

    console.log('[AuthService] Login response:', response);
    // ... rest of method
  } catch (error) {
    console.error('[AuthService] Login error:', error);
    throw error;
  }
}
```

### Network Tab Inspection

1. Open DevTools → Network tab
2. Test login
3. Check:
   - POST to `/api/auth/login` has correct body
   - CSRF token sent in header
   - Cookies set in response
   - Response status and JSON

### Component State Inspection

Add temporary debugging to component:

```typescript
ngOnInit() {
  console.log('[LoginDialog] Providers input:', this.providers);
  // ... existing code
}
```

---

## Next Steps After Testing

1. **Fix any bugs found during testing**
2. **Update version to 2.0.0 in package.json**
3. **Build production version**: `npm run build`
4. **Publish to npm**: `npm run publish:npm`
5. **Update platforms to use v2.0.0**
6. **Document breaking changes in CHANGELOG.md**
