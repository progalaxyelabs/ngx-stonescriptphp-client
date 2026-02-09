import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthProvider } from '../../auth.service';
import { ProviderRegistryService } from '../../provider-registry.service';

@Component({
    selector: 'lib-login-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="login-dialog">
            <h2 class="login-title">Sign In</h2>

            <!-- Email/Password Form (if enabled) -->
            @if (isProviderEnabled('emailPassword')) {
                <form (ngSubmit)="onEmailLogin()" class="email-form">
                    <div class="form-group">
                        <input
                            [(ngModel)]="email"
                            name="email"
                            placeholder="Email"
                            type="email"
                            required
                            class="form-control">
                    </div>
                    <div class="form-group password-group">
                        <input
                            [(ngModel)]="password"
                            name="password"
                            placeholder="Password"
                            [type]="showPassword ? 'text' : 'password'"
                            required
                            class="form-control password-input">
                        <button
                            type="button"
                            class="password-toggle"
                            (click)="showPassword = !showPassword"
                            [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'">
                            {{ showPassword ? '👁️' : '👁️‍🗨️' }}
                        </button>
                    </div>
                    <button
                        type="submit"
                        [disabled]="loading"
                        class="btn btn-primary btn-block">
                        {{ loading ? 'Signing in...' : getProviderLabel('emailPassword') }}
                    </button>
                </form>
            }

            <!-- Divider if both email and OAuth are present -->
            @if (isProviderEnabled('emailPassword') && oauthProviders.length > 0) {
                <div class="divider">
                    <span>OR</span>
                </div>
            }

            <!-- OAuth Providers -->
            @if (oauthProviders.length > 0) {
                <div class="oauth-buttons">
                    @for (provider of oauthProviders; track provider) {
                        <button
                            (click)="onOAuthLogin(provider)"
                            [disabled]="loading"
                            [class]="'btn btn-oauth ' + getProviderCssClass(provider)"
                            [ngStyle]="getProviderButtonStyle(provider)">
                            @if (getProviderIcon(provider)) {
                                <span class="oauth-icon">
                                    {{ getProviderIcon(provider) }}
                                </span>
                            }
                            {{ getProviderLabel(provider) }}
                        </button>
                    }
                </div>
            }

            <!-- Error Message -->
            @if (error) {
                <div class="error-message">
                    {{ error }}
                </div>
            }

            <!-- Loading State -->
            @if (loading) {
                <div class="loading-overlay">
                    <div class="spinner"></div>
                </div>
            }

            <!-- Register Link -->
            <div class="register-link">
                Don't have an account?
                <a href="#" (click)="onRegisterClick($event)">Sign up</a>
            </div>
        </div>
    `,
    styles: [`
        .login-dialog {
            padding: 24px;
            max-width: 400px;
            position: relative;
        }

        .login-title {
            margin: 0 0 24px 0;
            font-size: 24px;
            font-weight: 500;
            text-align: center;
        }

        .email-form {
            margin-bottom: 16px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .password-group {
            position: relative;
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
            top: 50%;
            transform: translateY(-50%);
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

        .divider {
            margin: 16px 0;
            text-align: center;
            position: relative;
        }

        .divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: #ddd;
        }

        .divider span {
            background: white;
            padding: 0 12px;
            position: relative;
            color: #666;
            font-size: 12px;
        }

        .oauth-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .btn-oauth {
            width: 100%;
            background: white;
            color: #333;
            border: 1px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn-oauth:hover:not(:disabled) {
            background: #f8f8f8;
        }

        .btn-google {
            border-color: #4285f4;
        }

        .btn-linkedin {
            border-color: #0077b5;
        }

        .btn-apple {
            border-color: #000;
        }

        .btn-microsoft {
            border-color: #00a4ef;
        }

        .btn-github {
            border-color: #333;
        }

        .oauth-icon {
            font-size: 18px;
        }

        .error-message {
            margin-top: 16px;
            padding: 12px;
            background: #fee;
            color: #c33;
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

        .register-link {
            margin-top: 16px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }

        .register-link a {
            color: #4285f4;
            text-decoration: none;
        }

        .register-link a:hover {
            text-decoration: underline;
        }
    `]
})
export class LoginDialogComponent implements OnInit {
    /**
     * REQUIRED: Which authentication providers to show in this dialog
     * @example ['google', 'linkedin', 'emailPassword']
     */
    @Input() providers: AuthProvider[] = [];

    email = '';
    password = '';
    error = '';
    loading = false;
    showPassword = false;

    oauthProviders: AuthProvider[] = [];

    constructor(
        private auth: AuthService,
        private providerRegistry: ProviderRegistryService
    ) {}

    ngOnInit() {
        if (!this.providers || this.providers.length === 0) {
            this.error = 'Configuration Error: No authentication providers specified. Please pass providers to LoginDialogComponent.';
            throw new Error('LoginDialogComponent requires providers input. Example: dialogRef.componentInstance.providers = [\'google\', \'emailPassword\']');
        }

        // Get OAuth providers (excluding emailPassword)
        this.oauthProviders = this.providers
            .filter(p => p !== 'emailPassword');
    }

    isProviderEnabled(provider: AuthProvider): boolean {
        return this.providers.includes(provider);
    }

    getProviderLabel(provider: AuthProvider): string {
        return this.providerRegistry.getLabel(provider);
    }

    getProviderIcon(provider: AuthProvider): string | undefined {
        return this.providerRegistry.getIcon(provider);
    }

    getProviderCssClass(provider: AuthProvider): string {
        return this.providerRegistry.getCssClass(provider);
    }

    getProviderButtonStyle(provider: AuthProvider): Record<string, string> | null {
        return this.providerRegistry.getButtonStyle(provider);
    }

    async onEmailLogin() {
        if (!this.email || !this.password) {
            this.error = 'Please enter email and password';
            return;
        }

        this.loading = true;
        this.error = '';

        try {
            const result = await this.auth.loginWithEmail(this.email, this.password);
            if (!result.success) {
                this.error = result.message || 'Login failed';
            }
            // On success, parent component/dialog should close automatically via user$ subscription
        } catch (err) {
            this.error = 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    async onOAuthLogin(provider: AuthProvider) {
        this.loading = true;
        this.error = '';

        try {
            const result = await this.auth.loginWithProvider(provider);
            if (!result.success) {
                this.error = result.message || 'OAuth login failed';
            }
            // On success, parent component/dialog should close automatically via user$ subscription
        } catch (err) {
            this.error = 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    onRegisterClick(event: Event) {
        event.preventDefault();
        // Platforms can override this or listen for a custom event
        // For now, just emit a console message
        console.log('Register clicked - platform should handle navigation');
    }
}
