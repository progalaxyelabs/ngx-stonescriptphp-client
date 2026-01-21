#!/bin/bash
# Test Setup Script for ngx-stonescriptphp-client
#
# This script:
# 1. Builds the library
# 2. Creates a minimal Angular test app
# 3. Links the built library
# 4. Starts mock server and test app

set -e

echo "================================"
echo "ngx-stonescriptphp-client Test Setup"
echo "================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build the library
echo -e "\n${BLUE}[1/5]${NC} Building library..."
cd "$(dirname "$0")/.."
npm run build
echo -e "${GREEN}✓${NC} Library built successfully"

# Step 2: Check if Angular CLI is available
echo -e "\n${BLUE}[2/5]${NC} Checking Angular CLI..."
if ! command -v ng &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Angular CLI not found. Installing globally..."
    npm install -g @angular/cli
fi
echo -e "${GREEN}✓${NC} Angular CLI ready"

# Step 3: Create test app if it doesn't exist
TEST_APP_DIR="tests/angular-test-app"
if [ ! -d "$TEST_APP_DIR" ]; then
    echo -e "\n${BLUE}[3/5]${NC} Creating Angular test app..."
    cd tests
    ng new angular-test-app --standalone --routing --style=css --skip-git --package-manager=npm
    cd ..
    echo -e "${GREEN}✓${NC} Test app created"
else
    echo -e "\n${BLUE}[3/5]${NC} Test app already exists"
fi

# Step 4: Configure test app
echo -e "\n${BLUE}[4/5]${NC} Configuring test app..."

# Install Material Dialog (optional but recommended)
cd "$TEST_APP_DIR"
npm install @angular/material --legacy-peer-deps

# Link the built library
npm install ../../dist --legacy-peer-deps

# Create environment file
mkdir -p src/environments
cat > src/environments/environment.ts << 'EOF'
export const environment = {
  production: false,
  platformCode: 'test',
  accountsUrl: 'http://localhost:8080',
  apiServer: {
    host: 'http://localhost:8080/'
  },
  auth: {
    mode: 'cookie' as const,
    refreshEndpoint: '/auth/refresh',
    useCsrf: true,
    csrfTokenCookieName: 'csrf_token',
    refreshTokenCookieName: 'refresh_token',
    csrfHeaderName: 'X-CSRF-Token'
  }
};
EOF

# Create test component
cat > src/app/test-auth.component.ts << 'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  LoginDialogComponent,
  RegisterComponent,
  AuthService
} from '@progalaxyelabs/ngx-stonescriptphp-client';

@Component({
  selector: 'app-test-auth',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="container">
      <h1>ngx-stonescriptphp-client Test</h1>

      <div class="test-buttons">
        <button (click)="testGoogleEmail()" class="btn">
          Google + Email
        </button>

        <button (click)="testEmailOnly()" class="btn">
          Email Only
        </button>

        <button (click)="testAllProviders()" class="btn">
          All Providers
        </button>

        <button (click)="testRegister()" class="btn btn-secondary">
          Register
        </button>

        <button (click)="testNoProviders()" class="btn btn-danger">
          No Providers (Error Test)
        </button>
      </div>

      <div class="user-info" *ngIf="auth.isAuthenticated()">
        <h3>Authenticated User</h3>
        <pre>{{ (auth.user$ | async) | json }}</pre>
        <button (click)="signout()" class="btn btn-secondary">Sign Out</button>
      </div>

      <div class="instructions">
        <h3>Test Credentials</h3>
        <p><strong>Email:</strong> test@example.com</p>
        <p><strong>Password:</strong> Test@123</p>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
    }
    h1 {
      color: #333;
      text-align: center;
    }
    .test-buttons {
      margin: 30px 0;
    }
    .btn {
      display: block;
      width: 100%;
      margin: 10px 0;
      padding: 12px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    .btn:hover {
      background: #0056b3;
    }
    .btn-secondary {
      background: #6c757d;
    }
    .btn-secondary:hover {
      background: #545b62;
    }
    .btn-danger {
      background: #dc3545;
    }
    .btn-danger:hover {
      background: #c82333;
    }
    .user-info {
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .user-info h3 {
      margin-top: 0;
      color: #28a745;
    }
    pre {
      background: white;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .instructions {
      margin-top: 30px;
      padding: 20px;
      background: #fff3cd;
      border-radius: 4px;
      border-left: 4px solid #ffc107;
    }
    .instructions h3 {
      margin-top: 0;
    }
  `]
})
export class TestAuthComponent implements OnInit {
  constructor(
    private dialog: MatDialog,
    public auth: AuthService
  ) {}

  ngOnInit() {
    console.log('TestAuthComponent initialized');
    // Check session on load
    this.auth.checkSession();
  }

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

  testRegister() {
    this.dialog.open(RegisterComponent, {
      width: '400px'
    });
  }

  testNoProviders() {
    try {
      const dialogRef = this.dialog.open(LoginDialogComponent, {
        width: '400px'
      });
      // Intentionally NOT setting providers - should throw error
    } catch (error) {
      console.error('Expected error:', error);
      alert('Error: ' + error);
    }
  }

  async signout() {
    await this.auth.signout();
  }
}
EOF

# Update app.config.ts
cat > src/app/app.config.ts << 'EOF'
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import {
  NgxStoneScriptPhpClientModule,
  MyEnvironmentModel
} from '@progalaxyelabs/ngx-stonescriptphp-client';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    NgxStoneScriptPhpClientModule.forRoot(environment as MyEnvironmentModel)
  ]
};
EOF

# Update app.routes.ts
cat > src/app/app.routes.ts << 'EOF'
import { Routes } from '@angular/router';
import { TestAuthComponent } from './test-auth.component';

export const routes: Routes = [
  { path: '', redirectTo: '/test', pathMatch: 'full' },
  { path: 'test', component: TestAuthComponent }
];
EOF

cd ../..
echo -e "${GREEN}✓${NC} Test app configured"

# Step 5: Create run script
echo -e "\n${BLUE}[5/5]${NC} Creating run script..."
cat > tests/run-test.sh << 'EOF'
#!/bin/bash
# Run Test Environment

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting test environment...${NC}\n"

# Start mock server in background
echo -e "${GREEN}[1/2]${NC} Starting mock accounts server..."
node tests/mock-accounts-server/server.js &
MOCK_PID=$!

# Wait for server to start
sleep 2

# Start Angular app
echo -e "\n${GREEN}[2/2]${NC} Starting Angular test app..."
cd tests/angular-test-app
npm start &
NG_PID=$!

echo -e "\n${BLUE}================================${NC}"
echo -e "${GREEN}✓ Test environment running${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "\n📍 Mock Server: http://localhost:8080"
echo -e "📍 Test App: http://localhost:4200"
echo -e "\n📧 Test Credentials:"
echo -e "   Email: test@example.com"
echo -e "   Password: Test@123"
echo -e "\n${BLUE}Press Ctrl+C to stop${NC}\n"

# Cleanup on exit
trap "kill $MOCK_PID $NG_PID 2>/dev/null" EXIT

wait
EOF

chmod +x tests/run-test.sh

echo -e "${GREEN}✓${NC} Run script created"

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "\nTo start testing:"
echo -e "  ${BLUE}./tests/run-test.sh${NC}"
echo -e "\nOr manually:"
echo -e "  1. ${BLUE}node tests/mock-accounts-server/server.js${NC}"
echo -e "  2. ${BLUE}cd tests/angular-test-app && npm start${NC}"
echo -e "  3. Open ${BLUE}http://localhost:4200${NC}\n"
