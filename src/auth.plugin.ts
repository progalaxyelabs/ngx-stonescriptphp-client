import { InjectionToken } from '@angular/core';

export const AUTH_PLUGIN = new InjectionToken<AuthPlugin>('AUTH_PLUGIN');

export interface User {
    user_id: number;           // Always provided (legacy platforms or hashed UUID)
    id: string;                // Always provided (new auth system UUID or stringified user_id)
    email: string;
    display_name: string;      // Always provided (fallback to email prefix if missing)
    photo_url?: string;
    is_email_verified: boolean; // Always provided (defaults to false if missing)
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
}

export interface TenantMembership {
    tenant_id: string;
    slug: string;
    name: string;
    role: string;
    status: string;
    last_accessed?: string;
}

export interface RegisterTenantData {
    tenantName: string;
    displayName?: string;
    email?: string;
    password?: string;
    provider: string;
    role?: string; // 'owner' for store creation, 'cashier' etc. for employee addition
    countryCode?: string; // optional, defaults to 'IN' on auth service
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

    /** Register a new tenant (organization) */
    registerTenant?(data: RegisterTenantData): Promise<AuthResult>;

    /** Check if a tenant slug is available */
    checkTenantSlugAvailable?(slug: string): Promise<{ available: boolean; suggestion?: string }>;

    /** Check onboarding status for a user identity */
    checkOnboardingStatus?(identityId: string, platformCode?: string): Promise<any>;

    /** Complete tenant onboarding (create tenant with country + org name) */
    completeTenantOnboarding?(countryCode: string, tenantName: string, accessToken: string): Promise<any>;

    /** Check if user email exists */
    checkEmail?(email: string): Promise<{ exists: boolean; user?: any }>;

    // ── Multi-server (implemented by StoneScriptPHPAuth) ──────────────────────

    switchServer?(serverName: string): void;
    getAvailableServers?(): string[];
    getActiveServer?(): string | null;
    getServerConfig?(serverName?: string): any;
}
