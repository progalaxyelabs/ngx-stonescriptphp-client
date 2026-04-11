import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChildren, QueryList, ElementRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthProvider, AuthResult } from '../../auth.service';
import { ProviderRegistryService } from '../../provider-registry.service';
import { TenantMembership } from '../../auth.plugin';

export type { TenantMembership };

export type OtpStep = 'identifier' | 'code' | 'register';

export interface TenantSelectedEvent {
  tenantId: string;
  tenantSlug: string;
  role: string;
}

export interface OnboardingNeededEvent {
  auth_method: string;
  oauth_provider?: string;
  is_new_identity: boolean;
  identity: {
    email: string;
    phone?: string;
    display_name?: string;
    picture?: string;
  };
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

                <!-- OTP Flow -->
                @if (isProviderEnabled('otp') && otpActive) {
                    <!-- OTP Step 1: Identifier entry -->
                    @if (otpStep === 'identifier') {
                        <form (ngSubmit)="onOtpSend()" class="otp-form">
                            @if (otpIdentifierError) {
                                <div [class]="'otp-identifier-error otp-identifier-error--' + otpIdentifierErrorColor">
                                    {{ otpIdentifierError }}
                                </div>
                            }
                            <div class="form-group">
                                <input
                                    [(ngModel)]="otpIdentifier"
                                    name="otpIdentifier"
                                    [placeholder]="otpPlaceholderText"
                                    type="text"
                                    required
                                    autocomplete="email tel"
                                    class="form-control"
                                    (input)="onOtpIdentifierChange()">
                                @if (otpIdentifierHint) {
                                    <div class="field-hint">{{ otpIdentifierHint }}</div>
                                }
                            </div>
                            <button
                                type="submit"
                                [disabled]="loading || !otpIdentifier.trim()"
                                class="btn btn-primary btn-block">
                                {{ loading ? 'Sending...' : 'Send OTP' }}
                            </button>
                            @if (error && otpIdentifier.trim()) {
                                <button
                                    type="button"
                                    class="btn btn-link btn-block otp-already-have"
                                    (click)="onSkipToOtpEntry()">
                                    I already have an OTP
                                </button>
                            }
                        </form>
                    }

                    <!-- OTP Step 2: Code entry -->
                    @if (otpStep === 'code') {
                        <div class="otp-code-section">
                            <p class="otp-subtitle">
                                Enter the 6-digit code sent to
                                <strong>{{ otpMaskedIdentifier }}</strong>
                            </p>
                            <div class="otp-digits">
                                @for (digit of otpDigits; track $index; let i = $index) {
                                    <input
                                        #otpInput
                                        type="text"
                                        inputmode="numeric"
                                        maxlength="1"
                                        class="otp-digit-input"
                                        [value]="otpDigits[i]"
                                        (input)="onOtpDigitInput($event, i)"
                                        (keydown)="onOtpDigitKeydown($event, i)"
                                        (paste)="onOtpPaste($event)">
                                }
                            </div>
                            <div class="otp-actions">
                                <button
                                    type="button"
                                    (click)="onOtpVerify()"
                                    [disabled]="loading || otpCode.length < 6"
                                    class="btn btn-primary btn-block">
                                    {{ loading ? 'Verifying...' : 'Verify' }}
                                </button>
                            </div>
                            <div class="otp-resend">
                                @if (otpResendCountdown > 0) {
                                    <span class="resend-timer">
                                        Resend in {{ formatCountdown(otpResendCountdown) }}
                                    </span>
                                } @else {
                                    <a href="#" (click)="onOtpResend($event)" class="resend-link">
                                        Resend OTP
                                    </a>
                                }
                            </div>
                            <div class="otp-back">
                                <a href="#" (click)="onOtpBack($event)">
                                    Use a different {{ otpIdentifierName }}
                                </a>
                            </div>
                        </div>
                    }

                    <!-- OTP Step 3: Registration (new user) -->
                    @if (otpStep === 'register') {
                        <div class="otp-register-section">
                            <p class="otp-subtitle">
                                Welcome! Enter your name to get started.
                            </p>
                            <form (ngSubmit)="onOtpRegister()" class="otp-form">
                                <div class="form-group">
                                    <input
                                        [(ngModel)]="otpDisplayName"
                                        name="displayName"
                                        placeholder="Your Name"
                                        type="text"
                                        required
                                        class="form-control">
                                </div>
                                <button
                                    type="submit"
                                    [disabled]="loading || !otpDisplayName.trim()"
                                    class="btn btn-primary btn-block">
                                    {{ loading ? 'Creating account...' : 'Continue' }}
                                </button>
                            </form>
                        </div>
                    }

                    <!-- Divider before other providers -->
                    @if (effectiveOauthProviders.length > 0 || isProviderEnabled('emailPassword')) {
                        <div class="divider">
                            <span>OR</span>
                        </div>
                    }
                }

                <!-- Email/Password Form (if enabled) -->
                @if (isProviderEnabled('emailPassword') && !useOAuth && !otpActive) {
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
                                {{ showPassword ? '&#x1F441;' : '&#x1F441;&#x200D;&#x1F5E8;' }}
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
                    @if (effectiveOauthProviders.length > 0) {
                        <div class="divider">
                            <span>OR</span>
                        </div>
                    }
                }

                <!-- OAuth Providers (always visible as alternative sign-in) -->
                @if (effectiveOauthProviders.length > 0) {
                    <div class="oauth-buttons">
                        @for (provider of effectiveOauthProviders; track provider) {
                            <button
                                type="button"
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

                <!-- Switch between OAuth and Email/Password -->
                @if (isProviderEnabled('emailPassword') && effectiveOauthProviders.length > 0 && !otpActive) {
                    <div class="switch-method">
                        <a href="#" (click)="toggleAuthMethod($event)">
                            {{ useOAuth ? 'Use email/password instead' : 'Use OAuth instead' }}
                        </a>
                    </div>
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

        .email-form, .otp-form {
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

        .field-hint {
            margin-top: 4px;
            font-size: 12px;
            color: #888;
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

        .btn-zoho {
            background-color: #f0483e;
            color: white;
            border: 1px solid #d63b32;
        }

        .btn-zoho:hover {
            background-color: #d63b32;
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

        /* OTP styles */
        .otp-subtitle {
            text-align: center;
            font-size: 14px;
            color: #555;
            margin-bottom: 20px;
        }

        .otp-digits {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 20px;
        }

        .otp-digit-input {
            width: 44px;
            height: 52px;
            text-align: center;
            font-size: 22px;
            font-weight: 600;
            border: 2px solid #ddd;
            border-radius: 8px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }

        .otp-digit-input:focus {
            border-color: #4285f4;
        }

        .otp-actions {
            margin-bottom: 12px;
        }

        .otp-resend {
            text-align: center;
            font-size: 14px;
            margin-bottom: 8px;
        }

        .resend-timer {
            color: #888;
        }

        .resend-link {
            color: #4285f4;
            text-decoration: none;
            cursor: pointer;
        }

        .resend-link:hover {
            text-decoration: underline;
        }

        .otp-back {
            text-align: center;
            font-size: 13px;
        }

        .otp-back a {
            color: #888;
            text-decoration: none;
        }

        .otp-back a:hover {
            text-decoration: underline;
            color: #4285f4;
        }

        .otp-register-section .otp-subtitle {
            color: #2e7d32;
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

        .otp-identifier-error {
            margin-bottom: 12px;
            padding: 10px 12px;
            border-radius: 4px;
            font-size: 14px;
        }

        .otp-identifier-error--red {
            background: #fee;
            color: #c33;
        }

        .otp-identifier-error--orange {
            background: #fff3e0;
            color: #e65100;
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
export class TenantLoginComponent implements OnInit, OnDestroy {
    @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

    // Component Configuration
    @Input() title: string = 'Sign In';
    @Input() providers: AuthProvider[] = ['google'];
    @Input() showTenantSelector: boolean = true;
    @Input() autoSelectSingleTenant: boolean = true;
    @Input() prefillEmail?: string;  // Email to prefill (for account linking flow)
    @Input() allowTenantCreation: boolean = true;
    @Input() otpIdentifierTypes: ('email' | 'phone')[] = ['email', 'phone'];  // Allowed OTP identifier types

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
    @Output() needsOnboarding = new EventEmitter<OnboardingNeededEvent>();
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

    // Effective OAuth providers (filtered for Android WebView)
    effectiveOauthProviders: AuthProvider[] = [];

    // OTP State
    otpActive = false;
    otpStep: OtpStep = 'identifier';
    otpIdentifier = '';
    otpIdentifierHint = '';
    otpIdentifierError = '';
    otpIdentifierErrorColor: 'orange' | 'red' = 'red';
    otpNormalizedIdentifier = '';  // E.164 for phone, as-is for email
    otpMaskedIdentifier = '';
    otpDigits: string[] = ['', '', '', '', '', ''];
    otpVerifiedToken = '';
    otpDisplayName = '';
    otpResendCountdown = 0;
    private otpResendTimer: ReturnType<typeof setInterval> | null = null;

    // Android WebView detection
    private isAndroidWebView = false;

    // Tenant Selection State
    showingTenantSelector = false;
    memberships: TenantMembership[] = [];
    selectedTenantId: string | null = null;
    userName: string = '';

    constructor(
        private auth: AuthService,
        private providerRegistry: ProviderRegistryService,
        private zone: NgZone,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        if (!this.providers || this.providers.length === 0) {
            this.error = 'Configuration Error: No authentication providers specified.';
            throw new Error('TenantLoginComponent requires providers input.');
        }

        // Detect Android WebView
        this.isAndroidWebView = /wv|Android.*Version\//.test(navigator.userAgent);

        // Filter out 'otp' and 'emailPassword' for OAuth list
        this.oauthProviders = this.providers.filter(p => p !== 'emailPassword' && p !== 'otp');

        // Auto-hide Google on Android WebView
        this.effectiveOauthProviders = this.isAndroidWebView
            ? this.oauthProviders.filter(p => p !== 'google')
            : [...this.oauthProviders];

        // If OTP is configured, it becomes the primary login method
        if (this.isProviderEnabled('otp')) {
            this.otpActive = true;
        }

        // If only emailPassword is available (no OTP, no OAuth), use it by default
        if (!this.otpActive && this.effectiveOauthProviders.length === 0 && this.isProviderEnabled('emailPassword')) {
            this.useOAuth = false;
        }

        // Prefill email if provided (for account linking flow)
        if (this.prefillEmail) {
            this.email = this.prefillEmail;
            this.useOAuth = false;
            this.otpActive = false;  // Switch to email/password form for linking
        }
    }

    ngOnDestroy() {
        this.clearResendTimer();
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

            // Authentication successful — pass result so membership can be reused
            await this.handlePostAuthFlow(result);
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

            // New identity — user exists but has no tenant membership
            if (result.isNewIdentity && result.user) {
                this.needsOnboarding.emit({
                    auth_method: result.authMethod || 'oauth',
                    oauth_provider: result.oauthProvider,
                    is_new_identity: true,
                    identity: {
                        email: result.user.email,
                        display_name: result.user.display_name,
                        picture: result.user.photo_url,
                    },
                });
                return;
            }

            // Multi-tenant selection — user has multiple memberships
            if (result.memberships && result.memberships.length > 0) {
                this.memberships = result.memberships;
                this.showingTenantSelector = true;
                return;
            }

            // Standard success — pass result so membership can be reused if present
            await this.handlePostAuthFlow(result);
        } catch (err: any) {
            this.error = err.message || 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    async handlePostAuthFlow(loginResult?: AuthResult) {
        if (!this.showTenantSelector) {
            // Tenant selection is disabled, emit event immediately
            this.tenantSelected.emit({
                tenantId: '',
                tenantSlug: '',
                role: ''
            });
            return;
        }

        // Resolve memberships — prefer data from login response to avoid extra API call
        this.loading = true;

        try {
            let memberships: TenantMembership[];

            if (loginResult?.membership) {
                // Login response already included membership — use it directly
                memberships = [loginResult.membership];
            } else {
                // Fall back to fetching memberships from API (with platform_code param)
                const result = await this.auth.getTenantMemberships();
                memberships = result.memberships;
            }

            if (!memberships || memberships.length === 0) {
                // User has no tenants, prompt to create one
                this.error = 'You are not a member of any organization. Please create one.';
                if (this.allowTenantCreation) {
                    setTimeout(() => this.createTenant.emit(), 2000);
                }
                return;
            }

            this.memberships = memberships;

            // Get user name if available
            const currentUser = this.auth.getCurrentUser();
            if (currentUser) {
                this.userName = currentUser.display_name || currentUser.email;
            }

            // Auto-select if user has only one tenant
            if (this.memberships.length === 1 && this.autoSelectSingleTenant) {
                const m = this.memberships[0];
                // If login already returned a tenant-scoped token (via membership in response),
                // just emit — no need to call select-tenant again.
                if (loginResult?.membership) {
                    this.tenantSelected.emit({ tenantId: m.tenant_id, tenantSlug: m.slug, role: m.role });
                    return;
                }
                await this.selectAndContinue(m);
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

    // ── OTP methods ────────────────────────────────────────────────────────────

    /** Detect identifier type from input and show hint */
    onOtpIdentifierChange() {
        const value = this.otpIdentifier.trim();
        if (!value) {
            this.otpIdentifierHint = '';
            return;
        }
        const detected = this.detectIdentifierType(value);
        if (detected === 'email') {
            this.otpIdentifierHint = 'OTP will be sent to this email';
        } else if (detected === 'phone') {
            const digits = value.replace(/\D/g, '');
            if (digits.length === 10) {
                this.otpIdentifierHint = 'OTP will be sent to +91 ' + digits;
            } else {
                this.otpIdentifierHint = 'OTP will be sent to this number';
            }
        } else {
            this.otpIdentifierHint = '';
        }
    }

    /** Send OTP to the entered identifier */
    async onOtpSend() {
        // Wrap in NgZone so post-await state mutations trigger change detection.
        // The underlying AuthService plugin uses raw fetch() which is NOT patched
        // by the default zone.js polyfill, so awaited continuations would otherwise
        // run outside NgZone and skip CD entirely. See #2227.
        return this.zone.run(async () => {
            const raw = this.otpIdentifier.trim();
            if (!raw) {
                this.error = `Please enter your ${this.otpIdentifierName}`;
                return;
            }

            const type = this.detectIdentifierType(raw);
            if (!type) {
                this.error = `Please enter a valid ${this.otpIdentifierName}`;
                return;
            }

            // Normalize: auto-prepend +91 for 10-digit Indian numbers
            if (type === 'phone') {
                const digits = raw.replace(/\D/g, '');
                this.otpNormalizedIdentifier = digits.length === 10 ? `+91${digits}` : `+${digits}`;
            } else {
                this.otpNormalizedIdentifier = raw;
            }

            this.loading = true;
            this.error = '';
            this.otpIdentifierError = '';

            try {
                const result = await this.auth.sendOtp(this.otpNormalizedIdentifier);
                if (!result.success) {
                    this.error = 'Failed to send OTP. Please try again.';
                    return;
                }
                this.otpMaskedIdentifier = result.masked_identifier;
                this.otpDigits = ['', '', '', '', '', ''];
                this.otpStep = 'code';
                this.startResendCountdown(result.resend_after || 60);

                // Focus first digit input after view update
                setTimeout(() => this.focusOtpInput(0), 50);
            } catch (err: any) {
                this.error = err.message || 'Failed to send OTP';
            } finally {
                this.loading = false;
                // Explicit CD tick — zone.run's sync frame has already exited by the time
                // post-await continuations run, so NgZone microtask tracking can't be relied
                // on when the underlying plugin uses raw fetch(). See #2227.
                this.cdr.detectChanges();
            }
        });
    }

    /** Skip to OTP code entry when user already has a code */
    onSkipToOtpEntry(): void {
        this.error = '';
        this.otpMaskedIdentifier = this.otpIdentifier;
        this.otpDigits = ['', '', '', '', '', ''];
        this.otpStep = 'code';
        setTimeout(() => this.focusOtpInput(0), 50);
    }

    /** Verify the entered OTP code */
    async onOtpVerify() {
        // Wrap in NgZone so post-await state mutations trigger change detection.
        // The underlying AuthService plugin uses raw fetch() which is NOT patched
        // by the default zone.js polyfill, so awaited continuations would otherwise
        // run outside NgZone and skip CD entirely. See #2227.
        return this.zone.run(async () => {
            if (this.loading) return;

            const code = this.otpCode;
            if (code.length < 6) {
                this.error = 'Please enter the complete 6-digit code';
                return;
            }

            this.loading = true;
            this.error = '';

            try {
                const verifyResult = await this.auth.verifyOtp(this.otpNormalizedIdentifier, code);
                if (!verifyResult.success) {
                    switch (verifyResult.error) {
                        case 'otp_expired':
                            this.resetToIdentifierStep('Your code has expired. Please request a new one.', 'orange');
                            break;
                        case 'otp_invalid': {
                            const attempts = verifyResult.remaining_attempts;
                            this.error = attempts !== undefined
                                ? `Invalid code. ${attempts} attempt${attempts === 1 ? '' : 's'} remaining.`
                                : 'Invalid code. Please try again.';
                            break;
                        }
                        case 'otp_rate_limited':
                            this.resetToIdentifierStep('Too many attempts. Please try again later.', 'red');
                            break;
                        case 'otp_not_found':
                            this.resetToIdentifierStep('No code found. Please request a new one.', 'orange');
                            break;
                        default:
                            this.error = verifyResult.message || 'Invalid code. Please try again.';
                    }
                    return;
                }

                this.otpVerifiedToken = verifyResult.verified_token;

                // Auto-attempt login
                const loginResult = await this.auth.identityLogin(this.otpVerifiedToken);

                if (loginResult.success) {
                    // Existing user — proceed with standard post-auth flow
                    await this.handlePostAuthFlow(loginResult);
                    return;
                }

                if (loginResult.message === 'identity_not_found') {
                    // New user — show registration form
                    this.otpStep = 'register';
                    return;
                }

                // Other login error
                this.error = loginResult.message || 'Login failed. Please try again.';
            } catch (err: any) {
                this.error = err.message || 'Verification failed';
            } finally {
                this.loading = false;
                // Explicit CD tick — zone.run's sync frame has already exited by the time
                // post-await continuations run, so NgZone microtask tracking can't be relied
                // on when the underlying plugin uses raw fetch(). See #2227.
                this.cdr.detectChanges();
            }
        });
    }

    /** Register a new identity after OTP verification */
    async onOtpRegister() {
        // Wrap in NgZone so post-await state mutations trigger change detection.
        // The underlying AuthService plugin uses raw fetch() which is NOT patched
        // by the default zone.js polyfill, so awaited continuations would otherwise
        // run outside NgZone and skip CD entirely. See #2227.
        return this.zone.run(async () => {
            const name = this.otpDisplayName.trim();
            if (!name) {
                this.error = 'Please enter your name';
                return;
            }

            this.loading = true;
            this.error = '';

            try {
                const result = await this.auth.identityRegister(this.otpVerifiedToken, name);

                if (!result.success) {
                    // If token expired, restart OTP flow
                    if (result.message?.includes('expired') || result.message?.includes('Invalid')) {
                        this.error = 'Session expired. Please verify again.';
                        this.otpStep = 'identifier';
                        this.otpVerifiedToken = '';
                        this.otpDisplayName = '';
                        return;
                    }
                    this.error = result.message || 'Registration failed';
                    return;
                }

                // New identity created — emit onboarding event
                const identifierType = this.detectIdentifierType(this.otpIdentifier.trim());
                this.needsOnboarding.emit({
                    auth_method: 'otp',
                    is_new_identity: true,
                    identity: {
                        email: identifierType === 'email' ? this.otpNormalizedIdentifier : '',
                        phone: identifierType === 'phone' ? this.otpNormalizedIdentifier : undefined,
                        display_name: name,
                    },
                });
            } catch (err: any) {
                this.error = err.message || 'Registration failed';
            } finally {
                this.loading = false;
                // Explicit CD tick — zone.run's sync frame has already exited by the time
                // post-await continuations run, so NgZone microtask tracking can't be relied
                // on when the underlying plugin uses raw fetch(). See #2227.
                this.cdr.detectChanges();
            }
        });
    }

    /** Resend the OTP */
    onOtpResend(event: Event) {
        event.preventDefault();
        this.onOtpSend();
    }

    /** Go back to identifier entry */
    onOtpBack(event: Event) {
        event.preventDefault();
        this.otpStep = 'identifier';
        this.otpDigits = ['', '', '', '', '', ''];
        this.otpVerifiedToken = '';
        this.error = '';
        this.otpIdentifierError = '';
        this.clearResendTimer();
    }

    /**
     * Reset to the identifier entry step (step 1) with an error message.
     * Used when OTP verification fails with a code that requires re-sending
     * (expired, rate-limited, not-found). Keeps the identifier pre-filled.
     */
    private resetToIdentifierStep(message: string, color: 'orange' | 'red') {
        this.otpStep = 'identifier';
        this.otpDigits = ['', '', '', '', '', ''];
        this.otpVerifiedToken = '';
        this.error = '';
        this.clearResendTimer();
        this.otpIdentifierError = message;
        this.otpIdentifierErrorColor = color;
    }

    // ── OTP digit input handling ─────────────────────────────────────────────

    onOtpDigitInput(event: Event, index: number) {
        const input = event.target as HTMLInputElement;
        const value = input.value.replace(/\D/g, '');
        this.otpDigits[index] = value ? value[0] : '';
        input.value = this.otpDigits[index];

        // Auto-advance to next input
        if (value && index < 5) {
            this.focusOtpInput(index + 1);
        }

        // Auto-verify when all 6 digits entered
        if (this.otpCode.length === 6) {
            this.onOtpVerify();
        }
    }

    onOtpDigitKeydown(event: KeyboardEvent, index: number) {
        if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
            this.focusOtpInput(index - 1);
        }
    }

    onOtpPaste(event: ClipboardEvent) {
        event.preventDefault();
        const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        for (let i = 0; i < 6; i++) {
            this.otpDigits[i] = pasted[i] || '';
        }
        // Update all input elements
        const inputs = this.otpInputs?.toArray();
        if (inputs) {
            for (let i = 0; i < 6; i++) {
                inputs[i].nativeElement.value = this.otpDigits[i];
            }
        }
        if (pasted.length >= 6) {
            this.onOtpVerify();
        } else {
            this.focusOtpInput(Math.min(pasted.length, 5));
        }
    }

    get otpCode(): string {
        return this.otpDigits.join('');
    }

    get otpPlaceholderText(): string {
        const allowsEmail = this.otpIdentifierTypes.includes('email');
        const allowsPhone = this.otpIdentifierTypes.includes('phone');

        if (allowsEmail && allowsPhone) {
            return 'Enter Email or Phone Number';
        } else if (allowsEmail) {
            return 'Enter Email';
        } else if (allowsPhone) {
            return 'Enter Phone Number';
        }
        return 'Enter Identifier';
    }

    get otpIdentifierName(): string {
        const allowsEmail = this.otpIdentifierTypes.includes('email');
        const allowsPhone = this.otpIdentifierTypes.includes('phone');

        if (allowsEmail && allowsPhone) {
            return 'email or phone number';
        } else if (allowsEmail) {
            return 'email';
        } else if (allowsPhone) {
            return 'phone number';
        }
        return 'identifier';
    }

    // ── OTP helpers ──────────────────────────────────────────────────────────

    private detectIdentifierType(value: string): 'email' | 'phone' | null {
        const allowsEmail = this.otpIdentifierTypes.includes('email');
        const allowsPhone = this.otpIdentifierTypes.includes('phone');

        if (value.includes('@')) {
            // Basic email validation
            const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            return (isValidEmail && allowsEmail) ? 'email' : null;
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 15) {
            return allowsPhone ? 'phone' : null;
        }
        return null;
    }

    private focusOtpInput(index: number) {
        const inputs = this.otpInputs?.toArray();
        if (inputs && inputs[index]) {
            inputs[index].nativeElement.focus();
            inputs[index].nativeElement.select();
        }
    }

    private startResendCountdown(seconds: number) {
        this.clearResendTimer();
        this.otpResendCountdown = seconds;
        this.otpResendTimer = setInterval(() => {
            this.otpResendCountdown--;
            if (this.otpResendCountdown <= 0) {
                this.clearResendTimer();
            }
        }, 1000);
    }

    private clearResendTimer() {
        if (this.otpResendTimer) {
            clearInterval(this.otpResendTimer);
            this.otpResendTimer = null;
        }
        this.otpResendCountdown = 0;
    }

    formatCountdown(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ── Formatting helpers ───────────────────────────────────────────────────

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
