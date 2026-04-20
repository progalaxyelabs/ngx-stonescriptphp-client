import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChildren, QueryList, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AuthProvider, AuthResult } from '../../auth.service';
import { ProviderRegistryService } from '../../provider-registry.service';
import { TenantMembership } from '../../auth.plugin';

export type { TenantMembership };

export type OtpStep = 'identifier' | 'code' | 'register';

/** Auth method mutex state — prevents concurrent auth flows */
export type CommittedFlow = 'none' | 'otp' | 'oauth';

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
            @if (!showingTenantSelector()) {
                <!-- Step 1: Authentication -->
                <h2 class="login-title">{{ title }}</h2>

                <!-- OTP Flow -->
                @if (isProviderEnabled('otp') && otpActive()) {
                    <!-- OTP Step 1: Identifier entry -->
                    @if (otpStep() === 'identifier') {
                        <form (ngSubmit)="onOtpSend()" class="otp-form">
                            @if (otpIdentifierError()) {
                                <div [class]="'otp-identifier-error otp-identifier-error--' + otpIdentifierErrorColor()">
                                    {{ otpIdentifierError() }}
                                </div>
                            }
                            <div class="form-group">
                                <input
                                    [ngModel]="otpIdentifierValue()"
                                    (ngModelChange)="setOtpIdentifier($event)"
                                    name="otpIdentifier"
                                    [placeholder]="otpPlaceholderText"
                                    type="text"
                                    required
                                    autocomplete="email tel"
                                    class="form-control"
                                    [disabled]="!canUseOtpForm()"
                                    (input)="onOtpIdentifierChange()">
                                @if (otpIdentifierHint()) {
                                    <div class="field-hint">{{ otpIdentifierHint() }}</div>
                                }
                            </div>
                            <button
                                type="submit"
                                [disabled]="loading() || !otpIdentifierValue().trim() || !canUseOtpForm()"
                                class="btn btn-primary btn-block">
                                {{ loading() ? 'Sending...' : 'Send OTP' }}
                            </button>
                            @if (error() && otpIdentifierValue().trim()) {
                                <button
                                    type="button"
                                    class="btn btn-link btn-block otp-already-have"
                                    (click)="onSkipToOtpEntry()"
                                    [disabled]="!canUseOtpForm()">
                                    I already have an OTP
                                </button>
                            }
                        </form>
                    }

                    <!-- OTP Step 2: Code entry -->
                    @if (otpStep() === 'code') {
                        <div class="otp-code-section">
                            <p class="otp-subtitle">
                                Enter the 6-digit code sent to
                                <strong>{{ otpMaskedIdentifier() }}</strong>
                            </p>
                            <div class="otp-digits">
                                @for (digit of otpDigits(); track $index; let i = $index) {
                                    <input
                                        #otpInput
                                        type="text"
                                        inputmode="numeric"
                                        maxlength="1"
                                        class="otp-digit-input"
                                        [value]="otpDigits()[i]"
                                        (input)="onOtpDigitInput($event, i)"
                                        (keydown)="onOtpDigitKeydown($event, i)"
                                        (paste)="onOtpPaste($event)">
                                }
                            </div>
                            <div class="otp-actions">
                                <button
                                    type="button"
                                    (click)="onOtpVerify()"
                                    [disabled]="loading() || otpCode.length < 6"
                                    class="btn btn-primary btn-block">
                                    {{ loading() ? 'Verifying...' : 'Verify' }}
                                </button>
                            </div>
                            <div class="otp-resend">
                                @if (otpResendCountdown() > 0) {
                                    <span class="resend-timer">
                                        Resend in {{ formatCountdown(otpResendCountdown()) }}
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
                    @if (otpStep() === 'register') {
                        <div class="otp-register-section">
                            <p class="otp-subtitle">
                                Welcome! Enter your name to get started.
                            </p>
                            <form (ngSubmit)="onOtpRegister()" class="otp-form">
                                <div class="form-group">
                                    <input
                                        [ngModel]="otpDisplayNameValue()"
                                        (ngModelChange)="setOtpDisplayName($event)"
                                        name="displayName"
                                        placeholder="Your Name"
                                        type="text"
                                        required
                                        class="form-control">
                                </div>
                                <button
                                    type="submit"
                                    [disabled]="loading() || !otpDisplayNameValue().trim()"
                                    class="btn btn-primary btn-block">
                                    {{ loading() ? 'Creating account...' : 'Continue' }}
                                </button>
                            </form>
                        </div>
                    }

                    <!-- Divider before other providers (hidden during OTP code/register steps) -->
                    @if ((effectiveOauthProviders().length > 0 || isProviderEnabled('emailPassword')) && otpStep() === 'identifier') {
                        <div class="divider">
                            <span>OR</span>
                        </div>
                    }
                }

                <!-- Email/Password Form (if enabled) -->
                @if (isProviderEnabled('emailPassword') && !useOAuth() && !otpActive()) {
                    <form (ngSubmit)="onEmailLogin()" class="email-form">
                        <div class="form-group">
                            <input
                                [ngModel]="emailValue()"
                                (ngModelChange)="setEmail($event)"
                                name="email"
                                placeholder="Email"
                                type="email"
                                required
                                class="form-control">
                        </div>
                        <div class="form-group password-group">
                            <input
                                [ngModel]="passwordValue()"
                                (ngModelChange)="setPassword($event)"
                                name="password"
                                placeholder="Password"
                                [type]="showPassword() ? 'text' : 'password'"
                                required
                                class="form-control password-input">
                            <button
                                type="button"
                                class="password-toggle"
                                (click)="togglePasswordVisibility()"
                                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                                {{ showPassword() ? '&#x1F441;' : '&#x1F441;&#x200D;&#x1F5E8;' }}
                            </button>
                        </div>
                        <button
                            type="submit"
                            [disabled]="loading()"
                            class="btn btn-primary btn-block">
                            {{ loading() ? 'Signing in...' : 'Sign in with Email' }}
                        </button>
                    </form>

                    <!-- Divider -->
                    @if (effectiveOauthProviders().length > 0) {
                        <div class="divider">
                            <span>OR</span>
                        </div>
                    }
                }

                <!-- OAuth Providers (hidden when OTP flow is committed or during code/register steps) -->
                @if (canShowOAuth()) {
                    <div class="oauth-buttons">
                        @for (provider of effectiveOauthProviders(); track provider) {
                            <button
                                type="button"
                                (click)="onOAuthLogin(provider)"
                                [disabled]="loading()"
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
                @if (isProviderEnabled('emailPassword') && effectiveOauthProviders().length > 0 && !otpActive()) {
                    <div class="switch-method">
                        <a href="#" (click)="toggleAuthMethod($event)">
                            {{ useOAuth() ? 'Use email/password instead' : 'Use OAuth instead' }}
                        </a>
                    </div>
                }

                <!-- Error Message -->
                @if (error()) {
                    <div class="error-message">
                        {{ error() }}
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

                @if (userName()) {
                    <div class="welcome-message">
                        Welcome back, <strong>{{ userName() }}</strong>!
                    </div>
                }

                <p class="selector-description">{{ tenantSelectorDescription }}</p>

                <div class="tenant-list">
                    @for (membership of memberships(); track membership.tenant_id) {
                        <div
                            class="tenant-item"
                            [class.selected]="selectedTenantId() === membership.tenant_id"
                            (click)="selectTenantItem(membership.tenant_id)">
                            <div class="tenant-radio">
                                <input
                                    type="radio"
                                    [checked]="selectedTenantId() === membership.tenant_id"
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
                    [disabled]="!selectedTenantId() || loading()"
                    class="btn btn-primary btn-block">
                    {{ loading() ? 'Loading...' : continueButtonText }}
                </button>

                <!-- Error Message -->
                @if (error()) {
                    <div class="error-message">
                        {{ error() }}
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
            @if (loading()) {
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

        .form-control:disabled {
            background: #f5f5f5;
            cursor: not-allowed;
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

    // Component Configuration (static inputs)
    @Input() title: string = 'Sign In';
    @Input() providers: AuthProvider[] = ['google'];
    @Input() showTenantSelector: boolean = true;
    @Input() autoSelectSingleTenant: boolean = true;
    @Input() prefillEmail?: string;
    @Input() allowTenantCreation: boolean = true;
    @Input() otpIdentifierTypes: ('email' | 'phone')[] = ['email', 'phone'];
    /**
     * OTP mode — controls which auth endpoint is called and what error is shown:
     * - 'login'   → /api/auth/login/email/otp/send  — fails if email not registered
     * - 'signup'  → /api/auth/register/email/otp/send — fails if email already registered
     * - undefined → /api/auth/otp/send — unified mode, backward-compat (default)
     */
    @Input() mode?: 'login' | 'signup';

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

    // ── Signals: Form Fields ────────────────────────────────────────────────────
    private readonly _email = signal('');
    private readonly _password = signal('');

    // ── Signals: UI State ───────────────────────────────────────────────────────
    readonly error = signal('');
    readonly loading = signal(false);
    readonly showPassword = signal(false);
    readonly useOAuth = signal(true);
    private oauthProviders: AuthProvider[] = [];
    readonly effectiveOauthProviders = signal<AuthProvider[]>([]);

    // ── Signals: Auth Method Mutex (journey-seam fix) ───────────────────────────
    readonly committedFlow = signal<CommittedFlow>('none');

    // ── Signals: OTP State ──────────────────────────────────────────────────────
    readonly otpActive = signal(false);
    readonly otpStep = signal<OtpStep>('identifier');
    private readonly _otpIdentifier = signal('');
    readonly otpIdentifierHint = signal('');
    readonly otpIdentifierError = signal('');
    readonly otpIdentifierErrorColor = signal<'orange' | 'red'>('red');
    private readonly _otpNormalizedIdentifier = signal('');
    readonly otpMaskedIdentifier = signal('');
    readonly otpDigits = signal<string[]>(['', '', '', '', '', '']);
    private readonly _otpVerifiedToken = signal('');
    private readonly _otpDisplayName = signal('');
    readonly otpResendCountdown = signal(0);
    private otpResendTimer: ReturnType<typeof setInterval> | null = null;

    // Android WebView detection
    private isAndroidWebView = false;

    // ── Signals: Tenant Selection State ─────────────────────────────────────────
    readonly showingTenantSelector = signal(false);
    readonly memberships = signal<TenantMembership[]>([]);
    readonly selectedTenantId = signal<string | null>(null);
    readonly userName = signal('');

    // ── Computed: Auth Method Mutex Guards ──────────────────────────────────────
    /**
     * OAuth buttons are visible when:
     * - There are OAuth providers configured
     * - User hasn't committed to OTP flow
     * - OTP step is at identifier entry (or OTP not active)
     */
    readonly canShowOAuth = computed(() =>
        this.effectiveOauthProviders().length > 0 &&
        this.committedFlow() !== 'otp' &&
        (!this.otpActive() || this.otpStep() === 'identifier')
    );

    /**
     * OTP form is enabled when:
     * - User hasn't committed to OAuth flow
     */
    readonly canUseOtpForm = computed(() =>
        this.committedFlow() !== 'oauth'
    );

    // ── Signal value getters (for ngModel binding) ──────────────────────────────
    readonly emailValue = computed(() => this._email());
    readonly passwordValue = computed(() => this._password());
    readonly otpIdentifierValue = computed(() => this._otpIdentifier());
    readonly otpDisplayNameValue = computed(() => this._otpDisplayName());

    constructor(
        private auth: AuthService,
        private providerRegistry: ProviderRegistryService
    ) {}

    ngOnInit() {
        if (!this.providers || this.providers.length === 0) {
            this.error.set('Configuration Error: No authentication providers specified.');
            throw new Error('TenantLoginComponent requires providers input.');
        }

        // Detect Android WebView
        this.isAndroidWebView = /wv|Android.*Version\//.test(navigator.userAgent);

        // Filter out 'otp' and 'emailPassword' for OAuth list
        this.oauthProviders = this.providers.filter(p => p !== 'emailPassword' && p !== 'otp');

        // Auto-hide Google on Android WebView
        const filteredProviders = this.isAndroidWebView
            ? this.oauthProviders.filter(p => p !== 'google')
            : [...this.oauthProviders];
        this.effectiveOauthProviders.set(filteredProviders);

        // If OTP is configured, it becomes the primary login method
        if (this.isProviderEnabled('otp')) {
            this.otpActive.set(true);
        }

        // If only emailPassword is available (no OTP, no OAuth), use it by default
        if (!this.otpActive() && this.effectiveOauthProviders().length === 0 && this.isProviderEnabled('emailPassword')) {
            this.useOAuth.set(false);
        }

        // Prefill email if provided (for account linking flow)
        if (this.prefillEmail) {
            this._email.set(this.prefillEmail);
            this.useOAuth.set(false);
            this.otpActive.set(false);
        }
    }

    ngOnDestroy() {
        this.clearResendTimer();
    }

    // ── Signal setters (for ngModel two-way binding) ────────────────────────────
    setEmail(value: string) {
        this._email.set(value);
    }

    setPassword(value: string) {
        this._password.set(value);
    }

    setOtpIdentifier(value: string) {
        this._otpIdentifier.set(value);
    }

    setOtpDisplayName(value: string) {
        this._otpDisplayName.set(value);
    }

    togglePasswordVisibility() {
        this.showPassword.update(v => !v);
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
        this.useOAuth.update(v => !v);
        this.error.set('');
    }

    async onEmailLogin() {
        const email = this._email();
        const password = this._password();

        if (!email || !password) {
            this.error.set('Please enter email and password');
            return;
        }

        this.loading.set(true);
        this.error.set('');

        try {
            const result = await this.auth.loginWithEmail(email, password);

            if (!result.success) {
                this.error.set(result.message || 'Login failed');
                return;
            }

            await this.handlePostAuthFlow(result);
        } catch (err: any) {
            this.error.set(err.message || 'An unexpected error occurred');
        } finally {
            this.loading.set(false);
        }
    }

    async onOAuthLogin(provider: AuthProvider) {
        // Commit to OAuth flow — disable OTP inputs
        this.committedFlow.set('oauth');
        this.loading.set(true);
        this.error.set('');

        try {
            const result = await this.auth.loginWithProvider(provider);

            if (!result.success) {
                this.error.set(result.message || 'OAuth login failed');
                // OAuth failed/cancelled — reset mutex
                this.committedFlow.set('none');
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
                this.memberships.set(result.memberships);
                this.showingTenantSelector.set(true);
                return;
            }

            // Standard success
            await this.handlePostAuthFlow(result);
        } catch (err: any) {
            this.error.set(err.message || 'An unexpected error occurred');
            // OAuth failed — reset mutex
            this.committedFlow.set('none');
        } finally {
            this.loading.set(false);
        }
    }

    async handlePostAuthFlow(loginResult?: AuthResult) {
        if (!this.showTenantSelector) {
            this.tenantSelected.emit({
                tenantId: '',
                tenantSlug: '',
                role: ''
            });
            return;
        }

        this.loading.set(true);

        try {
            let membershipList: TenantMembership[];

            if (loginResult?.membership) {
                membershipList = [loginResult.membership];
            } else {
                const result = await this.auth.getTenantMemberships();
                membershipList = result.memberships;
            }

            if (!membershipList || membershipList.length === 0) {
                this.error.set('You are not a member of any organization. Please create one.');
                if (this.allowTenantCreation) {
                    setTimeout(() => this.createTenant.emit(), 2000);
                }
                return;
            }

            this.memberships.set(membershipList);

            const currentUser = this.auth.getCurrentUser();
            if (currentUser) {
                this.userName.set(currentUser.display_name || currentUser.email);
            }

            if (membershipList.length === 1 && this.autoSelectSingleTenant) {
                const m = membershipList[0];
                if (loginResult?.membership) {
                    this.tenantSelected.emit({ tenantId: m.tenant_id, tenantSlug: m.slug, role: m.role });
                    return;
                }
                await this.selectAndContinue(m);
            } else {
                this.showingTenantSelector.set(true);
            }
        } catch (err: any) {
            this.error.set(err.message || 'Failed to load organizations');
        } finally {
            this.loading.set(false);
        }
    }

    selectTenantItem(tenantId: string) {
        this.selectedTenantId.set(tenantId);
    }

    async onContinueWithTenant() {
        const tenantId = this.selectedTenantId();
        if (!tenantId) {
            this.error.set('Please select an organization');
            return;
        }

        const membership = this.memberships().find(m => m.tenant_id === tenantId);
        if (!membership) {
            this.error.set('Selected organization not found');
            return;
        }

        await this.selectAndContinue(membership);
    }

    async selectAndContinue(membership: TenantMembership) {
        this.loading.set(true);
        this.error.set('');

        try {
            const result = await this.auth.selectTenant(membership.tenant_id);

            if (!result.success) {
                this.error.set(result.message || 'Failed to select organization');
                return;
            }

            this.tenantSelected.emit({
                tenantId: membership.tenant_id,
                tenantSlug: membership.slug,
                role: membership.role
            });
        } catch (err: any) {
            this.error.set(err.message || 'An unexpected error occurred');
        } finally {
            this.loading.set(false);
        }
    }

    // ── OTP methods ────────────────────────────────────────────────────────────

    /** Detect identifier type from input and show hint; commit to OTP flow on valid input */
    onOtpIdentifierChange() {
        const value = this._otpIdentifier().trim();
        if (!value) {
            this.otpIdentifierHint.set('');
            // Empty input — reset mutex if still at identifier step
            if (this.otpStep() === 'identifier' && this.committedFlow() === 'otp') {
                this.committedFlow.set('none');
            }
            return;
        }

        const detected = this.detectIdentifierType(value);
        if (detected === 'email') {
            this.otpIdentifierHint.set('OTP will be sent to this email');
            // Valid email format — commit to OTP flow
            this.committedFlow.set('otp');
        } else if (detected === 'phone') {
            const digits = value.replace(/\D/g, '');
            if (digits.length === 10) {
                this.otpIdentifierHint.set('OTP will be sent to +91 ' + digits);
            } else {
                this.otpIdentifierHint.set('OTP will be sent to this number');
            }
            // Valid phone format — commit to OTP flow
            this.committedFlow.set('otp');
        } else {
            this.otpIdentifierHint.set('');
            // Invalid format — don't commit yet
        }
    }

    /** Send OTP to the entered identifier */
    async onOtpSend() {
        const raw = this._otpIdentifier().trim();
        if (!raw) {
            this.error.set(`Please enter your ${this.otpIdentifierName}`);
            return;
        }

        const type = this.detectIdentifierType(raw);
        if (!type) {
            this.error.set(`Please enter a valid ${this.otpIdentifierName}`);
            return;
        }

        // Normalize: auto-prepend +91 for 10-digit Indian numbers
        if (type === 'phone') {
            const digits = raw.replace(/\D/g, '');
            this._otpNormalizedIdentifier.set(digits.length === 10 ? `+91${digits}` : `+${digits}`);
        } else {
            this._otpNormalizedIdentifier.set(raw);
        }

        // Commit to OTP flow
        this.committedFlow.set('otp');
        this.loading.set(true);
        this.error.set('');
        this.otpIdentifierError.set('');

        try {
            const result = await this.auth.sendOtp(this._otpNormalizedIdentifier(), this.mode);
            if (!result.success) {
                if (result.error === 'identity_not_found') {
                    // Login mode: email not registered
                    this.otpIdentifierError.set(result.message || 'Account not found. Please sign up first.');
                    this.otpIdentifierErrorColor.set('red');
                    this.committedFlow.set('none');
                    return;
                }
                if (result.error === 'identity_exists') {
                    // Signup mode: email already registered
                    this.otpIdentifierError.set(result.message || 'Email already registered. Please sign in instead.');
                    this.otpIdentifierErrorColor.set('orange');
                    this.committedFlow.set('none');
                    return;
                }
                this.error.set('Failed to send OTP. Please try again.');
                return;
            }
            this.otpMaskedIdentifier.set(result.masked_identifier);
            this.otpDigits.set(['', '', '', '', '', '']);
            this.otpStep.set('code');
            this.startResendCountdown(result.resend_after || 60);

            // Focus first digit input after view update
            setTimeout(() => this.focusOtpInput(0), 50);
        } catch (err: any) {
            this.error.set(err.message || 'Failed to send OTP');
        } finally {
            this.loading.set(false);
        }
    }

    /** Skip to OTP code entry when user already has a code */
    onSkipToOtpEntry(): void {
        this.error.set('');
        this.otpMaskedIdentifier.set(this._otpIdentifier());
        this.otpDigits.set(['', '', '', '', '', '']);
        this.otpStep.set('code');
        // Commit to OTP flow
        this.committedFlow.set('otp');
        setTimeout(() => this.focusOtpInput(0), 50);
    }

    /** Verify the entered OTP code */
    async onOtpVerify() {
        if (this.loading()) return;

        const code = this.otpCode;
        if (code.length < 6) {
            this.error.set('Please enter the complete 6-digit code');
            return;
        }

        this.loading.set(true);
        this.error.set('');

        try {
            const verifyResult = await this.auth.verifyOtp(this._otpNormalizedIdentifier(), code);
            if (!verifyResult.success) {
                switch (verifyResult.error) {
                    case 'otp_expired':
                        this.resetToIdentifierStep('Your code has expired. Please request a new one.', 'orange');
                        break;
                    case 'otp_invalid': {
                        const attempts = verifyResult.remaining_attempts;
                        this.error.set(attempts !== undefined
                            ? `Invalid code. ${attempts} attempt${attempts === 1 ? '' : 's'} remaining.`
                            : 'Invalid code. Please try again.');
                        break;
                    }
                    case 'otp_rate_limited':
                        this.resetToIdentifierStep('Too many attempts. Please try again later.', 'red');
                        break;
                    case 'otp_not_found':
                        this.resetToIdentifierStep('No code found. Please request a new one.', 'orange');
                        break;
                    default:
                        this.error.set(verifyResult.message || 'Invalid code. Please try again.');
                }
                return;
            }

            this._otpVerifiedToken.set(verifyResult.verified_token);

            // Auto-attempt login
            const loginResult = await this.auth.identityLogin(this._otpVerifiedToken());

            if (loginResult.success) {
                // Existing user — proceed with standard post-auth flow
                await this.handlePostAuthFlow(loginResult);
                return;
            }

            if (loginResult.message === 'identity_not_found') {
                // New user — show registration form
                this.otpStep.set('register');
                return;
            }

            // Other login error
            this.error.set(loginResult.message || 'Login failed. Please try again.');
        } catch (err: any) {
            this.error.set(err.message || 'Verification failed');
        } finally {
            this.loading.set(false);
        }
    }

    /** Register a new identity after OTP verification */
    async onOtpRegister() {
        const name = this._otpDisplayName().trim();
        if (!name) {
            this.error.set('Please enter your name');
            return;
        }

        this.loading.set(true);
        this.error.set('');

        try {
            const result = await this.auth.identityRegister(this._otpVerifiedToken(), name);

            if (!result.success) {
                // If token expired, restart OTP flow
                if (result.message?.includes('expired') || result.message?.includes('Invalid')) {
                    this.error.set('Session expired. Please verify again.');
                    this.otpStep.set('identifier');
                    this._otpVerifiedToken.set('');
                    this._otpDisplayName.set('');
                    return;
                }
                this.error.set(result.message || 'Registration failed');
                return;
            }

            // New identity created — emit onboarding event
            const identifierType = this.detectIdentifierType(this._otpIdentifier().trim());
            this.needsOnboarding.emit({
                auth_method: 'otp',
                is_new_identity: true,
                identity: {
                    email: identifierType === 'email' ? this._otpNormalizedIdentifier() : '',
                    phone: identifierType === 'phone' ? this._otpNormalizedIdentifier() : undefined,
                    display_name: name,
                },
            });
        } catch (err: any) {
            this.error.set(err.message || 'Registration failed');
        } finally {
            this.loading.set(false);
        }
    }

    /** Resend the OTP */
    onOtpResend(event: Event) {
        event.preventDefault();
        this.onOtpSend();
    }

    /** Go back to identifier entry */
    onOtpBack(event: Event) {
        event.preventDefault();
        this.otpStep.set('identifier');
        this.otpDigits.set(['', '', '', '', '', '']);
        this._otpVerifiedToken.set('');
        this.error.set('');
        this.otpIdentifierError.set('');
        this.clearResendTimer();
        // Reset mutex — user can choose OAuth again
        this.committedFlow.set('none');
    }

    /**
     * Reset to the identifier entry step (step 1) with an error message.
     * Used when OTP verification fails with a code that requires re-sending
     * (expired, rate-limited, not-found). Keeps the identifier pre-filled.
     */
    private resetToIdentifierStep(message: string, color: 'orange' | 'red') {
        this.otpStep.set('identifier');
        this.otpDigits.set(['', '', '', '', '', '']);
        this._otpVerifiedToken.set('');
        this.error.set('');
        this.clearResendTimer();
        this.otpIdentifierError.set(message);
        this.otpIdentifierErrorColor.set(color);
        // Keep committedFlow as 'otp' since identifier is still filled
    }

    // ── OTP digit input handling ─────────────────────────────────────────────

    onOtpDigitInput(event: Event, index: number) {
        const input = event.target as HTMLInputElement;
        const value = input.value.replace(/\D/g, '');
        const currentDigits = [...this.otpDigits()];
        currentDigits[index] = value ? value[0] : '';
        this.otpDigits.set(currentDigits);
        input.value = currentDigits[index];

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
        if (event.key === 'Backspace' && !this.otpDigits()[index] && index > 0) {
            this.focusOtpInput(index - 1);
        }
    }

    onOtpPaste(event: ClipboardEvent) {
        event.preventDefault();
        const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        const newDigits = ['', '', '', '', '', ''];
        for (let i = 0; i < 6; i++) {
            newDigits[i] = pasted[i] || '';
        }
        this.otpDigits.set(newDigits);

        // Update all input elements
        const inputs = this.otpInputs?.toArray();
        if (inputs) {
            for (let i = 0; i < 6; i++) {
                inputs[i].nativeElement.value = newDigits[i];
            }
        }
        if (pasted.length >= 6) {
            this.onOtpVerify();
        } else {
            this.focusOtpInput(Math.min(pasted.length, 5));
        }
    }

    get otpCode(): string {
        return this.otpDigits().join('');
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
        this.otpResendCountdown.set(seconds);
        this.otpResendTimer = setInterval(() => {
            this.otpResendCountdown.update(v => v - 1);
            if (this.otpResendCountdown() <= 0) {
                this.clearResendTimer();
            }
        }, 1000);
    }

    private clearResendTimer() {
        if (this.otpResendTimer) {
            clearInterval(this.otpResendTimer);
            this.otpResendTimer = null;
        }
        this.otpResendCountdown.set(0);
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
