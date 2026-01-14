import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

export type LoginState = 'idle' | 'loading' | 'error' | 'requiresTenantSelection';

export interface LoginError {
  message: string;
  code?: string;
}

@Component({
  selector: 'ngx-ssp-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  @Input() platformCode!: string;
  @Input() tenantSlug?: string;
  @Input() redirectUrl: string = '/';
  @Input() showGoogleLogin: boolean = true;

  @Output() loginSuccess = new EventEmitter<AuthResponse>();
  @Output() tenantSelectionRequired = new EventEmitter<{ selectionToken: string, memberships: any[] }>();
  @Output() loginError = new EventEmitter<LoginError>();

  email: string = '';
  password: string = '';
  state: LoginState = 'idle';
  error: LoginError | null = null;

  // For tenant selection state
  selectionToken?: string;
  availableTenants?: any[];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.platformCode) {
      console.error('LoginComponent: platformCode is required');
    }
  }

  /**
   * Handle email/password login
   */
  onLogin(): void {
    // Validate inputs
    if (!this.email || !this.password) {
      this.setError('Please enter both email and password');
      return;
    }

    if (!this.platformCode) {
      this.setError('Platform code is not configured');
      return;
    }

    this.state = 'loading';
    this.error = null;

    this.authService.login(
      this.email,
      this.password,
      this.platformCode,
      this.tenantSlug
    ).subscribe({
      next: (response) => this.handleLoginResponse(response),
      error: (err) => this.handleLoginError(err)
    });
  }

  /**
   * Handle Google OAuth login
   */
  onLoginWithGoogle(): void {
    if (!this.platformCode) {
      this.setError('Platform code is not configured');
      return;
    }

    this.state = 'loading';
    this.error = null;

    // Redirect to Google OAuth
    this.authService.loginWithGoogle(this.platformCode, this.tenantSlug);
  }

  /**
   * Handle successful login response
   */
  private handleLoginResponse(response: AuthResponse): void {
    // Check if tenant selection is required
    if (response.selection_token && response.memberships && response.memberships.length > 1) {
      this.state = 'requiresTenantSelection';
      this.selectionToken = response.selection_token;
      this.availableTenants = response.memberships;
      this.tenantSelectionRequired.emit({
        selectionToken: response.selection_token,
        memberships: response.memberships
      });
    } else if (response.access_token && response.identity) {
      // Single tenant or tenant already selected
      this.state = 'idle';
      this.loginSuccess.emit(response);

      // Navigate to redirect URL
      if (this.redirectUrl) {
        this.router.navigate([this.redirectUrl]);
      }
    } else {
      this.setError('Invalid authentication response');
    }
  }

  /**
   * Handle login errors
   */
  private handleLoginError(err: any): void {
    this.state = 'error';

    let errorMessage = 'Login failed. Please try again.';
    let errorCode = 'UNKNOWN_ERROR';

    if (err.error) {
      // Handle structured error responses
      if (typeof err.error === 'string') {
        errorMessage = err.error;
      } else if (err.error.message) {
        errorMessage = err.error.message;
      } else if (err.error.error) {
        errorMessage = err.error.error;
      }

      if (err.error.code) {
        errorCode = err.error.code;
      }
    } else if (err.status === 401) {
      errorMessage = 'Invalid email or password';
      errorCode = 'INVALID_CREDENTIALS';
    } else if (err.status === 403) {
      errorMessage = 'Access denied. Please contact support.';
      errorCode = 'ACCESS_DENIED';
    } else if (err.status === 0) {
      errorMessage = 'Cannot connect to server. Please check your internet connection.';
      errorCode = 'NETWORK_ERROR';
    } else if (err.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
      errorCode = 'SERVER_ERROR';
    }

    const loginError: LoginError = {
      message: errorMessage,
      code: errorCode
    };

    this.error = loginError;
    this.loginError.emit(loginError);
  }

  /**
   * Set error state
   */
  private setError(message: string, code?: string): void {
    this.state = 'error';
    this.error = {
      message,
      code
    };
    this.loginError.emit(this.error);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error = null;
    if (this.state === 'error') {
      this.state = 'idle';
    }
  }

  /**
   * Get user-friendly state label
   */
  get stateLabel(): string {
    switch (this.state) {
      case 'loading':
        return 'Signing in...';
      case 'error':
        return 'Error';
      case 'requiresTenantSelection':
        return 'Select Tenant';
      default:
        return 'Sign In';
    }
  }

  /**
   * Check if form is valid
   */
  get isFormValid(): boolean {
    return !!(this.email && this.password && this.platformCode);
  }

  /**
   * Check if login button should be disabled
   */
  get isLoginDisabled(): boolean {
    return !this.isFormValid || this.state === 'loading';
  }
}
