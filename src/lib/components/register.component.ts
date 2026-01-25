import { Component, Output, EventEmitter, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth.service';
import { MyEnvironmentModel } from '../../my-environment.model';

@Component({
    selector: 'lib-register',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="register-dialog">
            <h2 class="register-title">Create Account</h2>

            <!-- Account Link Prompt -->
            @if (showAccountLinkPrompt) {
                <div class="account-link-prompt">
                    <div class="prompt-icon">🔗</div>
                    <h3>Account Already Exists</h3>
                    <p>
                        You already have an account with <strong>{{ existingEmail }}</strong>,
                        used on another ProGalaxy E-Labs platform.
                    </p>
                    <p>
                        Would you like to use the same account to access this platform?
                    </p>
                    <div class="prompt-actions">
                        <button type="button" class="btn btn-primary btn-block" (click)="linkExistingAccount()">
                            Yes, Use My Existing Account
                        </button>
                        <button type="button" class="btn btn-secondary btn-block" (click)="cancelLinking()">
                            No, Use Different Email
                        </button>
                    </div>
                </div>
            }

            <form *ngIf="!showAccountLinkPrompt" (ngSubmit)="onRegister()" class="register-form">
                <div class="form-group">
                    <label for="displayName">Full Name</label>
                    <input
                        id="displayName"
                        [(ngModel)]="displayName"
                        name="displayName"
                        placeholder="Enter your full name"
                        type="text"
                        required
                        class="form-control">
                </div>

                <div class="form-group">
                    <label for="email">Email</label>
                    <input
                        id="email"
                        [(ngModel)]="email"
                        name="email"
                        placeholder="Enter your email"
                        type="email"
                        required
                        class="form-control">
                </div>

                <div class="form-group password-group">
                    <label for="password">Password</label>
                    <input
                        id="password"
                        [(ngModel)]="password"
                        name="password"
                        placeholder="Create a password"
                        [type]="showPassword ? 'text' : 'password'"
                        required
                        minlength="8"
                        class="form-control password-input">
                    <button
                        type="button"
                        class="password-toggle"
                        (click)="showPassword = !showPassword"
                        [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'">
                        {{ showPassword ? '👁️' : '👁️‍🗨️' }}
                    </button>
                    <small class="form-hint">At least 8 characters</small>
                </div>

                <div class="form-group password-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input
                        id="confirmPassword"
                        [(ngModel)]="confirmPassword"
                        name="confirmPassword"
                        placeholder="Confirm your password"
                        [type]="showConfirmPassword ? 'text' : 'password'"
                        required
                        class="form-control password-input">
                    <button
                        type="button"
                        class="password-toggle"
                        (click)="showConfirmPassword = !showConfirmPassword"
                        [attr.aria-label]="showConfirmPassword ? 'Hide password' : 'Show password'">
                        {{ showConfirmPassword ? '👁️' : '👁️‍🗨️' }}
                    </button>
                </div>

                <button
                    type="submit"
                    [disabled]="loading"
                    class="btn btn-primary btn-block">
                    {{ loading ? 'Creating account...' : 'Sign Up' }}
                </button>
            </form>

            <!-- Error Message -->
            @if (error && !showAccountLinkPrompt) {
                <div class="error-message">
                    {{ error }}
                </div>
            }

            <!-- Success Message -->
            @if (success) {
                <div class="success-message">
                    {{ success }}
                </div>
            }

            <!-- Loading State -->
            @if (loading) {
                <div class="loading-overlay">
                    <div class="spinner"></div>
                </div>
            }

            <!-- Login Link -->
            <div *ngIf="!showAccountLinkPrompt" class="login-link">
                Already have an account?
                <a href="#" (click)="onLoginClick($event)">Sign in</a>
            </div>
        </div>
    `,
    styles: [`
        .register-dialog {
            padding: 24px;
            max-width: 400px;
            position: relative;
        }

        .register-title {
            margin: 0 0 24px 0;
            font-size: 24px;
            font-weight: 500;
            text-align: center;
        }

        .register-form {
            margin-bottom: 16px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .password-group {
            position: relative;
        }

        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #333;
        }

        .form-control {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }

        .password-input {
            padding-right: 45px;
        }

        .password-toggle {
            position: absolute;
            right: 8px;
            top: 38px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 18px;
            padding: 8px;
            line-height: 1;
            opacity: 0.6;
            transition: opacity 0.2s;
        }

        .password-toggle:hover {
            opacity: 1;
        }

        .password-toggle:focus {
            outline: 2px solid #4285f4;
            outline-offset: 2px;
            border-radius: 4px;
        }

        .form-control:focus {
            outline: none;
            border-color: #4285f4;
        }

        .form-hint {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            color: #666;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .btn-block {
            width: 100%;
        }

        .btn-primary {
            background-color: #4285f4;
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            background-color: #357ae8;
        }

        .error-message {
            margin-top: 16px;
            padding: 12px;
            background: #fee;
            color: #c33;
            border-radius: 4px;
            font-size: 14px;
        }

        .success-message {
            margin-top: 16px;
            padding: 12px;
            background: #efe;
            color: #3a3;
            border-radius: 4px;
            font-size: 14px;
        }

        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4285f4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .login-link {
            margin-top: 16px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }

        .login-link a {
            color: #4285f4;
            text-decoration: none;
        }

        .login-link a:hover {
            text-decoration: underline;
        }

        .account-link-prompt {
            background: #f8f9fa;
            border: 2px solid #4285f4;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 16px;
            text-align: center;
        }

        .prompt-icon {
            font-size: 48px;
            margin-bottom: 12px;
        }

        .account-link-prompt h3 {
            margin: 0 0 12px 0;
            color: #333;
            font-size: 20px;
            font-weight: 500;
        }

        .account-link-prompt p {
            margin: 8px 0;
            color: #555;
            font-size: 14px;
            line-height: 1.6;
        }

        .prompt-actions {
            margin-top: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .btn-secondary {
            background: white;
            color: #333;
            border: 1px solid #ddd;
        }

        .btn-secondary:hover:not(:disabled) {
            background: #f8f9fa;
            border-color: #ccc;
        }
    `]
})
export class RegisterComponent {
    @Output() navigateToLogin = new EventEmitter<string>();

    displayName = '';
    email = '';
    password = '';
    confirmPassword = '';
    error = '';
    success = '';
    loading = false;
    showAccountLinkPrompt = false;
    existingEmail = '';
    showPassword = false;
    showConfirmPassword = false;

    constructor(
        private auth: AuthService,
        @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel
    ) {}

    async onRegister() {
        // Reset messages
        this.error = '';
        this.success = '';

        // Validate fields
        if (!this.displayName || !this.email || !this.password || !this.confirmPassword) {
            this.error = 'Please fill in all fields';
            return;
        }

        if (this.password.length < 8) {
            this.error = 'Password must be at least 8 characters';
            return;
        }

        if (this.password !== this.confirmPassword) {
            this.error = 'Passwords do not match';
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.email)) {
            this.error = 'Please enter a valid email address';
            return;
        }

        this.loading = true;

        try {
            // Direct API call to check for email already registered
            const response = await fetch(`${this.environment.accountsUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: this.email,
                    password: this.password,
                    display_name: this.displayName,
                    platform: this.environment.platformCode
                })
            });

            const data = await response.json();

            if (response.ok && data.identity_id) {
                // Registration successful - now login
                const loginResult = await this.auth.loginWithEmail(this.email, this.password);

                if (loginResult.success) {
                    this.success = 'Account created successfully!';
                } else {
                    this.success = 'Account created! Please sign in.';
                }
            } else {
                // Check if email already registered
                if (data.error === 'Email already registered' || data.details?.includes('Email already registered')) {
                    this.existingEmail = this.email;
                    this.showAccountLinkPrompt = true;
                    this.error = '';
                } else {
                    // Other errors
                    this.error = data.error || data.details || 'Registration failed';
                }
            }
        } catch (err) {
            this.error = 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    onLoginClick(event: Event) {
        event.preventDefault();
        this.navigateToLogin.emit('');
    }

    linkExistingAccount() {
        // User confirmed they want to link their existing account
        this.navigateToLogin.emit(this.existingEmail);
    }

    cancelLinking() {
        // User decided not to link - reset form
        this.showAccountLinkPrompt = false;
        this.existingEmail = '';
        this.email = '';
        this.password = '';
        this.confirmPassword = '';
        this.displayName = '';
    }
}
