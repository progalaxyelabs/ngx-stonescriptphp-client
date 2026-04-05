import { InjectionToken } from '@angular/core';

export const AUTH_PLUGIN = new InjectionToken<AuthPlugin>('AUTH_PLUGIN');

export interface User {
    user_id?: number;          // Optional - not present in new auth responses (post-cleanup)
    id?: string;               // Optional - not present in new auth responses (post-cleanup)
    email: string;
    phone?: string;            // E.164 format (e.g., +919876543210) — set for phone-based auth
    display_name: string;      // Always provided (fallback to email prefix if missing)
    photo_url?: string;
    is_email_verified: boolean; // Always provided (defaults to false if missing)
    role?: string;             // Tenant role (e.g., 'admin', 'member') — extracted from JWT claims
}

// ── OTP types ────────────────────────────────────────────────────────────────

export interface OtpSendResponse {
    success: boolean;
    identifier_type: 'email' | 'phone';
    masked_identifier: string;
    expires_in: number;
    resend_after: number;
}

export interface OtpVerifyResponse {
    success: boolean;
    verified_token: string;
}

export interface AuthResult {
    success: boolean;
    message?: string;
    user?: User;
    /** Set by the plugin on successful auth — AuthService stores it in TokenService */
    accessToken?: string;
    /** Set by the plugin for body mode — AuthService stores it in TokenService */
    refreshToken?: string;
    needsVerification?: boolean;
    /** Membership returned directly by the login response (avoids extra API call) */
    membership?: TenantMembership;
    /** True when the user is new (has identity but no tenant membership) */
    isNewIdentity?: boolean;
    /** Auth method used (e.g., 'oauth', 'emailPassword') */
    authMethod?: string;
    /** OAuth provider used (e.g., 'google') */
    oauthProvider?: string;
    /** Identity info for new users (used with isNewIdentity) */
    identity?: { email: string; display_name?: string; picture?: string };
    /** Multiple tenant memberships for tenant selection flow */
    memberships?: TenantMembership[];
}

export interface TenantMembership {
    tenant_id: string;
    slug: string;
    name: string;
    role: string;
    status: string;
    last_accessed?: string;
}

/**
 * Auth plugin interface — implement this to support any auth backend.
 *
 * The library ships StoneScriptPHPAuth as the built-in plugin.
 * For external providers (Firebase, progalaxyelabs-auth, Okta, etc.),
 * create a class implementing this interface and provide it via
 * provideNgxStoneScriptPhpClient(environment, new YourAuthPlugin(...))
 *
 * @example Firebase
 * ```typescript
 * // firebase-auth.auth-plugin.ts (in your app)
 * export class FirebaseAuthPlugin implements AuthPlugin {
 *   async login(email, password): Promise<AuthResult> {
 *     const cred = await signInWithEmailAndPassword(getAuth(), email, password);
 *     return { success: true, accessToken: await cred.user.getIdToken() };
 *   }
 *   async refresh(): Promise<string | null> {
 *     const user = getAuth().currentUser;
 *     return user ? await user.getIdToken(true) : null;
 *   }
 *   // ...
 * }
 * ```
 */
export interface AuthPlugin {
    // ── Required ──────────────────────────────────────────────────────────────

    /**
     * Authenticate with email and password.
     * Return accessToken (and optionally refreshToken for body mode) in result.
     */
    login(email: string, password: string): Promise<AuthResult>;

    /**
     * Register a new user account.
     * Return accessToken on success.
     */
    register(email: string, password: string, displayName: string): Promise<AuthResult>;

    /**
     * Sign out the current user.
     * @param refreshToken - Current refresh token (for body mode revocation)
     */
    logout(refreshToken?: string): Promise<void>;

    /**
     * Check for an existing session on app init (e.g., via httpOnly refresh cookie).
     * Return success + accessToken if session is valid.
     */
    checkSession(): Promise<AuthResult>;

    /**
     * Refresh the access token.
     * @param accessToken - Current access token (for body mode)
     * @param refreshToken - Current refresh token (for body mode)
     * @returns New access token, or null if refresh failed
     */
    refresh(accessToken: string, refreshToken?: string): Promise<string | null>;

    // ── Optional ──────────────────────────────────────────────────────────────

    /** OAuth popup login (google, github, linkedin, etc.) */
    loginWithProvider?(provider: string): Promise<AuthResult>;

    /** Select a tenant and get a tenant-scoped access token */
    selectTenant?(tenantId: string, accessToken: string): Promise<AuthResult>;

    /** List tenant memberships for the authenticated user */
    getTenantMemberships?(accessToken: string): Promise<TenantMembership[]>;

    /** Check if a tenant slug is available */
    checkTenantSlugAvailable?(slug: string): Promise<{ available: boolean; suggestion?: string }>;

    /** Check onboarding status for a user identity */
    checkOnboardingStatus?(identityId: string, platformCode?: string): Promise<any>;

    /** Check if user email exists */
    checkEmail?(email: string): Promise<{ exists: boolean; user?: any }>;

    // ── OTP authentication ──────────────────────────────────────────────────────

    /** Send OTP to email or phone identifier */
    sendOtp?(identifier: string): Promise<OtpSendResponse>;

    /** Verify OTP code and receive a verified_token */
    verifyOtp?(identifier: string, code: string): Promise<OtpVerifyResponse>;

    /** Login with a verified_token (obtained from verifyOtp) */
    identityLogin?(verifiedToken: string): Promise<AuthResult>;

    /** Register a new identity with a verified_token (for new users) */
    identityRegister?(verifiedToken: string, displayName: string): Promise<AuthResult>;

    // ── Multi-server (implemented by StoneScriptPHPAuth) ──────────────────────

    switchServer?(serverName: string): void;
    getAvailableServers?(): string[];
    getActiveServer?(): string | null;
    getServerConfig?(serverName?: string): any;
}
