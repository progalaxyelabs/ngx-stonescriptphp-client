import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthProvider } from '../../auth.service';

export interface TenantCreatedEvent {
  tenant: { id: string; name: string; slug: string };
  user: { id: string; email: string; name: string };
}

@Component({
    selector: 'lib-tenant-register',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="tenant-register-dialog">
            <h2 class="register-title">{{ title }}</h2>

            <!-- Ownership Warning Message -->
            <div class="warning-box">
                <div class="warning-icon">⚠️</div>
                <div class="warning-content">
                    <strong>{{ ownershipTitle }}</strong>
                    <p>{{ ownershipMessage }}</p>
                </div>
            </div>

            <form (ngSubmit)="onRegister()" class="register-form">
                <!-- Tenant Information Section -->
                <div class="section-header">{{ tenantSectionTitle }}</div>

                <div class="form-group">
                    <label for="tenantName">{{ tenantNameLabel }} *</label>
                    <input
                        id="tenantName"
                        [(ngModel)]="tenantName"
                        name="tenantName"
                        [placeholder]="tenantNamePlaceholder"
                        type="text"
                        required
                        (input)="onTenantNameChange()"
                        class="form-control">
                </div>

                <div class="form-group">
                    <label for="tenantSlug">{{ tenantSlugLabel }} *</label>
                    <input
                        id="tenantSlug"
                        [(ngModel)]="tenantSlug"
                        name="tenantSlug"
                        [placeholder]="tenantSlugPlaceholder"
                        type="text"
                        required
                        pattern="[a-z0-9-]+"
                        (blur)="checkSlugAvailability()"
                        class="form-control"
                        [class.input-error]="slugError"
                        [class.input-success]="slugAvailable && tenantSlug">
                    @if (tenantSlug && urlPreviewEnabled) {
                        <small class="form-hint">
                            {{ urlPreviewPrefix }}{{ tenantSlug }}
                            @if (checkingSlug) {
                                <span class="checking">Checking...</span>
                            }
                            @if (slugAvailable && !checkingSlug) {
                                <span class="available">✓ Available</span>
                            }
                            @if (slugError) {
                                <span class="error-text">{{ slugError }}</span>
                            }
                        </small>
                    }
                </div>

                <!-- User Information Section -->
                <div class="section-header">{{ userSectionTitle }}</div>

                <!-- OAuth Providers (Primary Option) -->
                @if (oauthProviders.length > 0 && !useEmailPassword) {
                    <div class="oauth-section">
                        <p class="oauth-description">{{ oauthDescription }}</p>
                        <div class="oauth-buttons">
                            @for (provider of oauthProviders; track provider) {
                                <button
                                    type="button"
                                    (click)="onOAuthRegister(provider)"
                                    [disabled]="loading || !isFormValid()"
                                    class="btn btn-oauth btn-{{ provider }}">
                                    @if (getProviderIcon(provider)) {
                                        <span class="oauth-icon">
                                            {{ getProviderIcon(provider) }}
                                        </span>
                                    }
                                    {{ getProviderLabel(provider) }}
                                </button>
                            }
                        </div>
                    </div>

                    <!-- Switch to Email/Password -->
                    @if (isProviderEnabled('emailPassword')) {
                        <div class="switch-method">
                            <a href="#" (click)="toggleAuthMethod($event)">
                                {{ useEmailPassword ? 'Use OAuth instead' : 'Use email/password instead' }}
                            </a>
                        </div>
                    }
                }

                <!-- Email/Password Form (Fallback or Manual Entry) -->
                @if (useEmailPassword || oauthProviders.length === 0) {
                    <div class="form-group">
                        <label for="displayName">Full Name *</label>
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
                        <label for="email">Email *</label>
                        <input
                            id="email"
                            [(ngModel)]="email"
                            name="email"
                            placeholder="Enter your email"
                            type="email"
                            required
                            class="form-control">
                    </div>

                    <div class="form-group">
                        <label for="password">Password *</label>
                        <input
                            id="password"
                            [(ngModel)]="password"
                            name="password"
                            placeholder="Create a password"
                            type="password"
                            required
                            minlength="8"
                            class="form-control">
                        <small class="form-hint">At least 8 characters</small>
                    </div>

                    <div class="form-group">
                        <label for="confirmPassword">Confirm Password *</label>
                        <input
                            id="confirmPassword"
                            [(ngModel)]="confirmPassword"
                            name="confirmPassword"
                            placeholder="Confirm your password"
                            type="password"
                            required
                            class="form-control">
                    </div>

                    <button
                        type="submit"
                        [disabled]="loading || !isFormValid()"
                        class="btn btn-primary btn-block">
                        {{ loading ? 'Creating...' : submitButtonText }}
                    </button>

                    <!-- Switch to OAuth -->
                    @if (oauthProviders.length > 0) {
                        <div class="switch-method">
                            <a href="#" (click)="toggleAuthMethod($event)">
                                Use OAuth instead
                            </a>
                        </div>
                    }
                }
            </form>

            <!-- Error Message -->
            @if (error) {
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

            <!-- Loading Overlay -->
            @if (loading) {
                <div class="loading-overlay">
                    <div class="spinner"></div>
                    <p class="loading-text">{{ loadingText }}</p>
                </div>
            }

            <!-- Login Link -->
            <div class="login-link">
                {{ loginLinkText }}
                <a href="#" (click)="onLoginClick($event)">{{ loginLinkAction }}</a>
            </div>
        </div>
    `,
    styles: [`
        .tenant-register-dialog {
            padding: 24px;
            max-width: 500px;
            position: relative;
        }

        .register-title {
            margin: 0 0 20px 0;
            font-size: 24px;
            font-weight: 500;
            text-align: center;
        }

        .warning-box {
            display: flex;
            gap: 12px;
            padding: 16px;
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 6px;
            margin-bottom: 24px;
        }

        .warning-icon {
            font-size: 24px;
            line-height: 1;
        }

        .warning-content {
            flex: 1;
        }

        .warning-content strong {
            display: block;
            margin-bottom: 4px;
            color: #856404;
            font-size: 14px;
        }

        .warning-content p {
            margin: 0;
            color: #856404;
            font-size: 13px;
            line-height: 1.5;
        }

        .section-header {
            font-size: 16px;
            font-weight: 600;
            margin: 20px 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #e0e0e0;
            color: #333;
        }

        .register-form {
            margin-bottom: 16px;
        }

        .form-group {
            margin-bottom: 16px;
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
            transition: border-color 0.2s;
        }

        .form-control:focus {
            outline: none;
            border-color: #4285f4;
        }

        .form-control.input-error {
            border-color: #dc3545;
        }

        .form-control.input-success {
            border-color: #28a745;
        }

        .form-hint {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            color: #666;
        }

        .form-hint .checking {
            color: #666;
        }

        .form-hint .available {
            color: #28a745;
            font-weight: 500;
        }

        .form-hint .error-text {
            color: #dc3545;
        }

        .oauth-section {
            margin: 16px 0;
        }

        .oauth-description {
            margin-bottom: 12px;
            font-size: 14px;
            color: #666;
            text-align: center;
        }

        .oauth-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s, opacity 0.2s;
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

        .switch-method {
            margin-top: 12px;
            text-align: center;
            font-size: 14px;
        }

        .switch-method a {
            color: #4285f4;
            text-decoration: none;
        }

        .switch-method a:hover {
            text-decoration: underline;
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
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
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

        .loading-text {
            margin: 0;
            font-size: 14px;
            color: #666;
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
    `]
})
export class TenantRegisterComponent implements OnInit {
    // Component Configuration
    @Input() title: string = 'Create New Organization';
    @Input() providers: AuthProvider[] = ['google'];
    @Input() requireTenantName: boolean = true;

    // Tenant Labels
    @Input() tenantSectionTitle: string = 'Organization Information';
    @Input() tenantNameLabel: string = 'Organization Name';
    @Input() tenantNamePlaceholder: string = 'Enter your organization name';
    @Input() tenantSlugLabel: string = 'Organization URL';
    @Input() tenantSlugPlaceholder: string = 'organization-name';
    @Input() urlPreviewEnabled: boolean = true;
    @Input() urlPreviewPrefix: string = 'medstoreapp.in/';

    // User Labels
    @Input() userSectionTitle: string = 'Your Information';
    @Input() oauthDescription: string = 'Recommended: Sign up with your Google account';

    // Warning Message
    @Input() ownershipTitle: string = 'CREATING A NEW ORGANIZATION';
    @Input() ownershipMessage: string = 'You are registering as an organization owner. This will create a new organization that you will manage. If you are an employee, DO NOT use this form. Ask your organization owner to invite you, then use the Login page.';

    // Buttons and Links
    @Input() submitButtonText: string = 'Create Organization';
    @Input() loginLinkText: string = 'Already have an account?';
    @Input() loginLinkAction: string = 'Sign in';

    // Outputs
    @Output() tenantCreated = new EventEmitter<TenantCreatedEvent>();
    @Output() navigateToLogin = new EventEmitter<void>();

    // Form Fields
    tenantName = '';
    tenantSlug = '';
    displayName = '';
    email = '';
    password = '';
    confirmPassword = '';

    // State
    error = '';
    success = '';
    loading = false;
    loadingText = 'Creating your organization...';
    checkingSlug = false;
    slugAvailable = false;
    slugError = '';
    useEmailPassword = false;
    oauthProviders: AuthProvider[] = [];

    constructor(private auth: AuthService) {}

    ngOnInit() {
        if (!this.providers || this.providers.length === 0) {
            this.error = 'Configuration Error: No authentication providers specified.';
            throw new Error('TenantRegisterComponent requires providers input.');
        }

        this.oauthProviders = this.providers.filter(p => p !== 'emailPassword');

        // If only emailPassword is available, show it by default
        if (this.oauthProviders.length === 0 && this.isProviderEnabled('emailPassword')) {
            this.useEmailPassword = true;
        }
    }

    isProviderEnabled(provider: AuthProvider): boolean {
        return this.providers.includes(provider);
    }

    getProviderLabel(provider: AuthProvider): string {
        const labels: Record<AuthProvider, string> = {
            google: 'Sign up with Google',
            linkedin: 'Sign up with LinkedIn',
            apple: 'Sign up with Apple',
            microsoft: 'Sign up with Microsoft',
            github: 'Sign up with GitHub',
            emailPassword: 'Sign up with Email'
        };
        return labels[provider];
    }

    getProviderIcon(provider: AuthProvider): string | undefined {
        return undefined;
    }

    onTenantNameChange() {
        // Auto-generate slug from tenant name
        if (this.tenantName) {
            const slug = this.tenantName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');

            this.tenantSlug = slug;
            this.slugError = '';
            this.slugAvailable = false;
        }
    }

    async checkSlugAvailability() {
        if (!this.tenantSlug || this.tenantSlug.length < 3) {
            this.slugError = 'Slug must be at least 3 characters';
            return;
        }

        if (!/^[a-z0-9-]+$/.test(this.tenantSlug)) {
            this.slugError = 'Only lowercase letters, numbers, and hyphens allowed';
            return;
        }

        this.checkingSlug = true;
        this.slugError = '';

        try {
            const result = await this.auth.checkTenantSlugAvailable(this.tenantSlug);

            if (result.available) {
                this.slugAvailable = true;
            } else {
                this.slugError = 'This URL is already taken';
                if (result.suggestion) {
                    this.slugError += `. Try: ${result.suggestion}`;
                }
            }
        } catch (err) {
            // Slug check failed, but don't block registration
            console.warn('Slug availability check failed:', err);
        } finally {
            this.checkingSlug = false;
        }
    }

    toggleAuthMethod(event: Event) {
        event.preventDefault();
        this.useEmailPassword = !this.useEmailPassword;
        this.error = '';
    }

    isFormValid(): boolean {
        // Tenant information must be valid
        if (!this.tenantName || !this.tenantSlug) {
            return false;
        }

        if (this.slugError) {
            return false;
        }

        // If using email/password, check those fields
        if (this.useEmailPassword) {
            if (!this.displayName || !this.email || !this.password || !this.confirmPassword) {
                return false;
            }

            if (this.password.length < 8) {
                return false;
            }

            if (this.password !== this.confirmPassword) {
                return false;
            }
        }

        return true;
    }

    async onOAuthRegister(provider: AuthProvider) {
        if (!this.isFormValid()) {
            this.error = 'Please complete the organization information';
            return;
        }

        this.loading = true;
        this.loadingText = `Signing up with ${provider}...`;
        this.error = '';

        try {
            const result = await this.auth.registerTenant({
                tenantName: this.tenantName,
                tenantSlug: this.tenantSlug,
                provider: provider
            });

            if (result.success && result.tenant && result.user) {
                this.success = 'Organization created successfully!';
                this.tenantCreated.emit({
                    tenant: result.tenant,
                    user: result.user
                });
            } else {
                this.error = result.message || 'Registration failed';
            }
        } catch (err: any) {
            this.error = err.message || 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    async onRegister() {
        if (!this.isFormValid()) {
            this.error = 'Please fill in all required fields correctly';
            return;
        }

        this.loading = true;
        this.loadingText = 'Creating your organization...';
        this.error = '';
        this.success = '';

        try {
            const result = await this.auth.registerTenant({
                tenantName: this.tenantName,
                tenantSlug: this.tenantSlug,
                displayName: this.displayName,
                email: this.email,
                password: this.password,
                provider: 'emailPassword'
            });

            if (result.success && result.tenant && result.user) {
                this.success = 'Organization created successfully!';
                this.tenantCreated.emit({
                    tenant: result.tenant,
                    user: result.user
                });
            } else {
                this.error = result.message || 'Registration failed';
            }
        } catch (err: any) {
            this.error = err.message || 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    onLoginClick(event: Event) {
        event.preventDefault();
        this.navigateToLogin.emit();
    }
}
