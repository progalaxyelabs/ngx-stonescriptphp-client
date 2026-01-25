import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthProvider } from '../../auth.service';

export interface TenantMembership {
  tenant_id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  last_accessed?: string;
}

export interface TenantSelectedEvent {
  tenantId: string;
  tenantSlug: string;
  role: string;
}

@Component({
    selector: 'lib-tenant-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="tenant-login-dialog">
            @if (!showingTenantSelector) {
                <!-- Step 1: Authentication -->
                <h2 class="login-title">{{ title }}</h2>

                <!-- Email/Password Form (if enabled) -->
                @if (isProviderEnabled('emailPassword') && !useOAuth) {
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
                            {{ loading ? 'Signing in...' : 'Sign in with Email' }}
                        </button>
                    </form>

                    <!-- Divider -->
                    @if (oauthProviders.length > 0) {
                        <div class="divider">
                            <span>OR</span>
                        </div>
                    }
                }

                <!-- OAuth Providers -->
                @if (oauthProviders.length > 0 && (useOAuth || !isProviderEnabled('emailPassword'))) {
                    <div class="oauth-buttons">
                        @for (provider of oauthProviders; track provider) {
                            <button
                                type="button"
                                (click)="onOAuthLogin(provider)"
                                [disabled]="loading"
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

                    <!-- Switch to Email/Password -->
                    @if (isProviderEnabled('emailPassword') && oauthProviders.length > 0) {
                        <div class="switch-method">
                            <a href="#" (click)="toggleAuthMethod($event)">
                                {{ useOAuth ? 'Use email/password instead' : 'Use OAuth instead' }}
                            </a>
                        </div>
                    }
                }

                <!-- Error Message -->
                @if (error) {
                    <div class="error-message">
                        {{ error }}
                    </div>
                }

                <!-- Register Link -->
                @if (allowTenantCreation) {
                    <div class="register-link">
                        {{ registerLinkText }}
                        <a href="#" (click)="onCreateTenantClick($event)">{{ registerLinkAction }}</a>
                    </div>
                }
            } @else {
                <!-- Step 2: Tenant Selection -->
                <h2 class="login-title">{{ tenantSelectorTitle }}</h2>

                @if (userName) {
                    <div class="welcome-message">
                        Welcome back, <strong>{{ userName }}</strong>!
                    </div>
                }

                <p class="selector-description">{{ tenantSelectorDescription }}</p>

                <div class="tenant-list">
                    @for (membership of memberships; track membership.tenant_id) {
                        <div
                            class="tenant-item"
                            [class.selected]="selectedTenantId === membership.tenant_id"
                            (click)="selectTenantItem(membership.tenant_id)">
                            <div class="tenant-radio">
                                <input
                                    type="radio"
                                    [checked]="selectedTenantId === membership.tenant_id"
                                    [name]="'tenant-' + membership.tenant_id"
                                    [id]="'tenant-' + membership.tenant_id">
                            </div>
                            <div class="tenant-info">
                                <div class="tenant-name">{{ membership.name }}</div>
                                <div class="tenant-meta">
                                    <span class="tenant-role">{{ formatRole(membership.role) }}</span>
                                    @if (membership.last_accessed) {
                                        <span class="tenant-separator">·</span>
                                        <span class="tenant-last-accessed">
                                            Last accessed {{ formatLastAccessed(membership.last_accessed) }}
                                        </span>
                                    }
                                </div>
                            </div>
                        </div>
                    }
                </div>

                <button
                    type="button"
                    (click)="onContinueWithTenant()"
                    [disabled]="!selectedTenantId || loading"
                    class="btn btn-primary btn-block">
                    {{ loading ? 'Loading...' : continueButtonText }}
                </button>

                <!-- Error Message -->
                @if (error) {
                    <div class="error-message">
                        {{ error }}
                    </div>
                }

                <!-- Create New Tenant Link -->
                @if (allowTenantCreation) {
                    <div class="create-tenant-link">
                        {{ createTenantLinkText }}
                        <a href="#" (click)="onCreateTenantClick($event)">{{ createTenantLinkAction }}</a>
                    </div>
                }
            }

            <!-- Loading Overlay -->
            @if (loading) {
                <div class="loading-overlay">
                    <div class="spinner"></div>
                </div>
            }
        </div>
    `,
    styles: [`
        .tenant-login-dialog {
            padding: 24px;
            max-width: 450px;
            position: relative;
        }

        .login-title {
            margin: 0 0 24px 0;
            font-size: 24px;
            font-weight: 500;
            text-align: center;
        }

        .welcome-message {
            margin-bottom: 16px;
            padding: 12px;
            background: #e8f5e9;
            border-radius: 4px;
            text-align: center;
            font-size: 14px;
            color: #2e7d32;
        }

        .selector-description {
            margin-bottom: 20px;
            font-size: 14px;
            color: #666;
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

        .tenant-list {
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .tenant-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .tenant-item:hover {
            border-color: #4285f4;
            background: #f8f9ff;
        }

        .tenant-item.selected {
            border-color: #4285f4;
            background: #e8f0fe;
        }

        .tenant-radio {
            flex-shrink: 0;
            padding-top: 2px;
        }

        .tenant-radio input[type="radio"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }

        .tenant-info {
            flex: 1;
        }

        .tenant-name {
            font-size: 16px;
            font-weight: 500;
            color: #333;
            margin-bottom: 4px;
        }

        .tenant-meta {
            font-size: 13px;
            color: #666;
        }

        .tenant-role {
            font-weight: 500;
            color: #4285f4;
        }

        .tenant-separator {
            margin: 0 6px;
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

        .create-tenant-link {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            font-size: 14px;
            color: #666;
        }

        .create-tenant-link a {
            color: #4285f4;
            text-decoration: none;
            font-weight: 500;
        }

        .create-tenant-link a:hover {
            text-decoration: underline;
        }
    `]
})
export class TenantLoginComponent implements OnInit {
    // Component Configuration
    @Input() title: string = 'Sign In';
    @Input() providers: AuthProvider[] = ['google'];
    @Input() showTenantSelector: boolean = true;
    @Input() autoSelectSingleTenant: boolean = true;
    @Input() allowTenantCreation: boolean = true;

    // Tenant Selector Labels
    @Input() tenantSelectorTitle: string = 'Select Organization';
    @Input() tenantSelectorDescription: string = 'Choose which organization you want to access:';
    @Input() continueButtonText: string = 'Continue';

    // Link Labels
    @Input() registerLinkText: string = "Don't have an account?";
    @Input() registerLinkAction: string = 'Sign up';
    @Input() createTenantLinkText: string = "Don't see your organization?";
    @Input() createTenantLinkAction: string = 'Create New Organization';

    // Outputs
    @Output() tenantSelected = new EventEmitter<TenantSelectedEvent>();
    @Output() createTenant = new EventEmitter<void>();

    // Form Fields
    email = '';
    password = '';

    // State
    error = '';
    loading = false;
    showPassword = false;
    useOAuth = true;
    oauthProviders: AuthProvider[] = [];

    // Tenant Selection State
    showingTenantSelector = false;
    memberships: TenantMembership[] = [];
    selectedTenantId: string | null = null;
    userName: string = '';

    constructor(private auth: AuthService) {}

    ngOnInit() {
        if (!this.providers || this.providers.length === 0) {
            this.error = 'Configuration Error: No authentication providers specified.';
            throw new Error('TenantLoginComponent requires providers input.');
        }

        this.oauthProviders = this.providers.filter(p => p !== 'emailPassword');

        // If only emailPassword is available, use it by default
        if (this.oauthProviders.length === 0 && this.isProviderEnabled('emailPassword')) {
            this.useOAuth = false;
        }
    }

    isProviderEnabled(provider: AuthProvider): boolean {
        return this.providers.includes(provider);
    }

    getProviderLabel(provider: AuthProvider): string {
        const labels: Record<AuthProvider, string> = {
            google: 'Sign in with Google',
            linkedin: 'Sign in with LinkedIn',
            apple: 'Sign in with Apple',
            microsoft: 'Sign in with Microsoft',
            github: 'Sign in with GitHub',
            emailPassword: 'Sign in with Email'
        };
        return labels[provider];
    }

    getProviderIcon(provider: AuthProvider): string | undefined {
        return undefined;
    }

    toggleAuthMethod(event: Event) {
        event.preventDefault();
        this.useOAuth = !this.useOAuth;
        this.error = '';
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
                return;
            }

            // Authentication successful, now handle tenant selection
            await this.handlePostAuthFlow();
        } catch (err: any) {
            this.error = err.message || 'An unexpected error occurred';
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
                return;
            }

            // Authentication successful, now handle tenant selection
            await this.handlePostAuthFlow();
        } catch (err: any) {
            this.error = err.message || 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    async handlePostAuthFlow() {
        if (!this.showTenantSelector) {
            // Tenant selection is disabled, emit event immediately
            this.tenantSelected.emit({
                tenantId: '',
                tenantSlug: '',
                role: ''
            });
            return;
        }

        // Fetch user's tenant memberships
        this.loading = true;

        try {
            const result = await this.auth.getTenantMemberships();

            if (!result.memberships || result.memberships.length === 0) {
                // User has no tenants, prompt to create one
                this.error = 'You are not a member of any organization. Please create one.';
                if (this.allowTenantCreation) {
                    setTimeout(() => this.createTenant.emit(), 2000);
                }
                return;
            }

            this.memberships = result.memberships;

            // Get user name if available
            const currentUser = this.auth.getCurrentUser();
            if (currentUser) {
                this.userName = currentUser.display_name || currentUser.email;
            }

            // Auto-select if user has only one tenant
            if (this.memberships.length === 1 && this.autoSelectSingleTenant) {
                await this.selectAndContinue(this.memberships[0]);
            } else {
                // Show tenant selector
                this.showingTenantSelector = true;
            }
        } catch (err: any) {
            this.error = err.message || 'Failed to load organizations';
        } finally {
            this.loading = false;
        }
    }

    selectTenantItem(tenantId: string) {
        this.selectedTenantId = tenantId;
    }

    async onContinueWithTenant() {
        if (!this.selectedTenantId) {
            this.error = 'Please select an organization';
            return;
        }

        const membership = this.memberships.find(m => m.tenant_id === this.selectedTenantId);
        if (!membership) {
            this.error = 'Selected organization not found';
            return;
        }

        await this.selectAndContinue(membership);
    }

    async selectAndContinue(membership: TenantMembership) {
        this.loading = true;
        this.error = '';

        try {
            const result = await this.auth.selectTenant(membership.tenant_id);

            if (!result.success) {
                this.error = result.message || 'Failed to select organization';
                return;
            }

            // Emit tenant selected event
            this.tenantSelected.emit({
                tenantId: membership.tenant_id,
                tenantSlug: membership.slug,
                role: membership.role
            });
        } catch (err: any) {
            this.error = err.message || 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    formatRole(role: string): string {
        return role.charAt(0).toUpperCase() + role.slice(1);
    }

    formatLastAccessed(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'today';
            if (diffDays === 1) return 'yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            return `${Math.floor(diffDays / 30)} months ago`;
        } catch {
            return dateStr;
        }
    }

    onCreateTenantClick(event: Event) {
        event.preventDefault();
        this.createTenant.emit();
    }
}
