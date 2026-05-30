import { Injectable, Inject, signal, computed } from '@angular/core';
import { TokenService } from './token.service';
import {
    MyEnvironmentModel,
    AuthPlugin,
    AuthResult,
    User,
    TenantMembership,
    OtpSendResponse,
    OtpVerifyResponse
} from '@progalaxyelabs/stonescriptphp-client-core';
import { AUTH_PLUGIN } from './auth.plugin';

// Re-export types for backward compatibility
export type { AuthResult, TenantMembership, User, AuthPlugin };

export type BuiltInProvider = 'google' | 'linkedin' | 'apple' | 'microsoft' | 'github' | 'zoho' | 'emailPassword';

/**
 * Authentication provider identifier.
 * Includes all built-in providers plus any custom string identifier.
 */
export type AuthProvider = BuiltInProvider | (string & {});

/**
 * AuthService — manages auth state and delegates all auth operations to the AuthPlugin.
 *
 * This service holds user state (via signal) and tokens (via TokenService).
 * It does not make any HTTP calls directly — all auth logic lives in the plugin.
 *
 * Provide a plugin via provideNgxStoneScriptPhpClient():
 * - Default: StoneScriptPHPAuth (from @progalaxyelabs/stonescriptphp-auth-client)
 * - External: any class implementing AuthPlugin
 */
@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly USER_STORAGE_KEY = 'progalaxyapi_user';

    /** Signal-based user state */
    readonly user = signal<User | null>(null);

    /** Computed: true if user is authenticated */
    readonly isLoggedIn = computed(() => this.user() !== null);

    constructor(
        @Inject(AUTH_PLUGIN) private plugin: AuthPlugin,
        private tokens: TokenService,
        @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel
    ) {
        this.restoreUser();
    }

    // ── State management ──────────────────────────────────────────────────────

    private restoreUser(): void {
        try {
            const userJson = localStorage.getItem(this.USER_STORAGE_KEY);
            if (userJson) this.updateUser(JSON.parse(userJson));
        } catch (error) {
            console.error('Failed to restore user from localStorage:', error);
        }
    }

    private saveUser(user: User | null): void {
        try {
            if (user) {
                localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(this.USER_STORAGE_KEY);
            }
        } catch (error) {
            console.error('Failed to save user to localStorage:', error);
        }
    }

    private updateUser(user: User | null): void {
        this.user.set(user);
        this.saveUser(user);
    }

    private storeAuthResult(result: AuthResult): void {
        if (result.accessToken) this.tokens.setAccessToken(result.accessToken);
        if (result.refreshToken) this.tokens.setRefreshToken(result.refreshToken);
        if (result.user) {
            // Enrich user with role from JWT claims if not already set
            const user = result.user.role
                ? result.user
                : this.enrichUserWithJwtRole(result.user, result.accessToken);
            this.updateUser(user);
        }
    }

    /**
     * Decode the access token and attach the `role` claim to the user object.
     */
    private enrichUserWithJwtRole(user: User, accessToken?: string): User {
        if (accessToken) {
            const claims = this.tokens.decodeJwtPayload(accessToken);
            if (claims?.role) {
                return { ...user, role: claims.role };
            }
        }
        return user;
    }

    // ── Core auth operations ──────────────────────────────────────────────────

    async loginWithEmail(email: string, password: string): Promise<AuthResult> {
        const result = await this.plugin.login(email, password);
        if (result.success) this.storeAuthResult(result);
        return result;
    }

    async loginWithGoogle(serverName?: string): Promise<AuthResult> {
        return this.loginWithProvider('google');
    }

    async loginWithGitHub(serverName?: string): Promise<AuthResult> {
        return this.loginWithProvider('github');
    }

    async loginWithLinkedIn(serverName?: string): Promise<AuthResult> {
        return this.loginWithProvider('linkedin');
    }

    async loginWithApple(serverName?: string): Promise<AuthResult> {
        return this.loginWithProvider('apple');
    }

    async loginWithMicrosoft(serverName?: string): Promise<AuthResult> {
        return this.loginWithProvider('microsoft');
    }

    async loginWithZoho(serverName?: string): Promise<AuthResult> {
        return this.loginWithProvider('zoho');
    }

    async loginWithProvider(provider: AuthProvider, serverName?: string): Promise<AuthResult> {
        if (provider === 'emailPassword') {
            throw new Error('Use loginWithEmail() for email/password authentication');
        }
        if (!this.plugin.loginWithProvider) {
            return { success: false, message: 'OAuth not supported by the configured auth plugin' };
        }
        const result = await this.plugin.loginWithProvider(provider);
        // OAuth pending lifecycle (auth server >= 2026-05-18):
        // If oauthPending=true, the accessToken is a short-lived pre-auth JWT.
        // We still store it so authenticated requests during the next gate work,
        // but the caller MUST eventually call promoteOAuth(state) to commit or
        // abandonOAuth(state) to discard. Do not treat oauthPending as a final
        // successful login — caller should check result.oauthPending and route
        // accordingly.
        if (result.success) this.storeAuthResult(result);
        return result;
    }

    /**
     * Commit a pending OAuth connection (created by an OAuth callback when the
     * email was new). Call this after the user completes the next gate (e.g.
     * tenant creation). Returns a full AuthResult with the final JWT.
     */
    async promoteOAuth(oauthState: string): Promise<AuthResult> {
        if (!this.plugin.promoteOAuth) {
            return { success: false, message: 'promoteOAuth not supported by the configured auth plugin' };
        }
        const result = await this.plugin.promoteOAuth(oauthState);
        if (result.success) this.storeAuthResult(result);
        return result;
    }

    /**
     * Discard a pending OAuth connection (user clicked "Start Over" or closed
     * the flow without committing). Idempotent. Also clears the pre-auth JWT
     * from local token storage so the session is fully reset.
     */
    async abandonOAuth(oauthState: string): Promise<{ success: boolean }> {
        const fallback = { success: true };
        try {
            if (!this.plugin.abandonOAuth) return fallback;
            const result = await this.plugin.abandonOAuth(oauthState);
            return result ?? fallback;
        } finally {
            // Always clear local token state — the pre-auth JWT is no longer valid
            this.tokens.clear();
            this.updateUser(null);
        }
    }

    async register(
        email: string,
        password: string,
        displayName: string,
        serverName?: string
    ): Promise<AuthResult> {
        const result = await this.plugin.register(email, password, displayName);
        if (result.success) this.storeAuthResult(result);
        return result;
    }

    async signout(serverName?: string): Promise<void> {
        const refreshToken = this.tokens.getRefreshToken() || undefined;
        await this.plugin.logout(refreshToken);
        this.tokens.clear();
        this.updateUser(null);
    }

    /**
     * Clear the local session immediately without hitting the server logout endpoint.
     * Called when the API returns 401 after a token refresh.
     *
     * @param loginRoute - Optional route to navigate to (not used in v2 - consumer handles navigation)
     */
    clearSession(loginRoute?: string): void {
        this.tokens.clear();
        this.updateUser(null);
    }


    /**
     * Refresh the access token. Called by ApiConnectionService on 401.
     * @returns true if token was refreshed, false if refresh failed
     */
    async refresh(): Promise<boolean> {
        const newToken = await this.plugin.refresh(
            this.tokens.getAccessToken(),
            this.tokens.getRefreshToken() || undefined
        );
        if (newToken) {
            this.tokens.setAccessToken(newToken);
            return true;
        }
        this.tokens.clear();
        this.updateUser(null);
        return false;
    }

    isAuthenticated(): boolean {
        return this.tokens.hasValidAccessToken();
    }

    // ── Profile management ────────────────────────────────────────────────────

    /**
     * Update the authenticated user's display name.
     */
    async updateProfile(displayName: string): Promise<{ success: boolean; message?: string }> {
        const accessToken = this.tokens.getAccessToken();
        if (!accessToken) {
            return { success: false, message: 'Not authenticated' };
        }
        try {
            const host = this.environment.apiServer.host;
            const response = await fetch(`${host}/api/account/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ display_name: displayName })
            });
            const data = await response.json();
            if (data.status === 'ok') {
                const currentUser = this.getCurrentUser();
                if (currentUser) {
                    this.updateUser({ ...currentUser, display_name: displayName });
                }
                return { success: true };
            }
            return { success: false, message: data.message || 'Profile update failed' };
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    getCurrentUser(): User | null {
        return this.user();
    }

    // ── OTP authentication ─────────────────────────────────────────────────────

    async sendOtp(identifier: string, mode: 'login' | 'signup', nameHint?: string): Promise<OtpSendResponse> {
        if (!this.plugin.sendOtp) {
            return { success: false, identifier_type: 'email', masked_identifier: '', expires_in: 0, resend_after: 0 };
        }
        return this.plugin.sendOtp(identifier, mode, nameHint);
    }

    async verifyOtp(identifier: string, code: string, mode: 'login' | 'register'): Promise<OtpVerifyResponse> {
        if (!this.plugin.verifyOtp) {
            return { success: false };
        }
        const result = await this.plugin.verifyOtp(identifier, code, mode);
        // OTP verify is terminal (AUTH-SPEC §1c/§1d): store tokens when the server
        // returns a full bundle so the app is immediately authenticated on success.
        if (result.success && result.accessToken) {
            this.storeAuthResult({
                success: true,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: result.user,
                membership: result.membership,
                memberships: result.memberships,
                isNewIdentity: result.isNewIdentity,
            });
        }
        return result;
    }

    async identityLogin(verifiedToken: string): Promise<AuthResult> {
        if (!this.plugin.identityLogin) {
            return { success: false, message: 'OTP login not supported by the configured auth plugin' };
        }
        const result = await this.plugin.identityLogin(verifiedToken);
        if (result.success) this.storeAuthResult(result);
        return result;
    }

    async identityRegister(verifiedToken: string, displayName: string): Promise<AuthResult> {
        if (!this.plugin.identityRegister) {
            return { success: false, message: 'OTP registration not supported by the configured auth plugin' };
        }
        const result = await this.plugin.identityRegister(verifiedToken, displayName);
        if (result.success) this.storeAuthResult(result);
        return result;
    }

    async cancelPendingOtp(identifier: string): Promise<{ success: boolean }> {
        if (!this.plugin.cancelPendingOtp) {
            return { success: true };
        }
        return this.plugin.cancelPendingOtp(identifier);
    }

    // ── Token exchange (for platform-owned roles) ──────────────────────────────

    async exchangeToken(endpoint = '/api/auth/exchange'): Promise<{
        success: boolean;
        message?: string;
        role?: string;
    }> {
        const identityToken = this.tokens.getAccessToken();
        if (!identityToken) {
            return { success: false, message: 'No identity token available' };
        }

        try {
            const host = this.environment.apiServer.host;
            const response = await fetch(`${host}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${identityToken}`
                },
                body: JSON.stringify({})
            });

            const data = await response.json();

            if (data.status === 'ok' && data.data?.access_token) {
                this.tokens.setIdentityToken(identityToken);
                this.tokens.setAccessToken(data.data.access_token);

                if (data.data.refresh_token) {
                    this.tokens.setRefreshToken(data.data.refresh_token);
                }

                const claims = this.tokens.decodeJwtPayload(data.data.access_token);
                const role = claims?.role || data.data.role;

                // AUTH-SPEC §4a: after exchange, the platform JWT must carry tenant_id when
                // the user is in a tenant session. Log a warning if unexpectedly missing —
                // this indicates a server-side auth issue, not a client bug. The server
                // guarantees tenant_id preservation (identity JWT without it returns 401).
                if (typeof console !== 'undefined' && !claims?.tenant_id) {
                    const identityClaims = this.tokens.decodeJwtPayload(identityToken);
                    if (identityClaims?.tenant_id) {
                        console.warn(
                            '[AuthService] exchangeToken: identity JWT had tenant_id but platform JWT does not.' +
                            ' This indicates a server-side exchange issue — tenant context may be lost.'
                        );
                    }
                }

                const currentUser = this.getCurrentUser();
                if (currentUser && role) {
                    this.updateUser({ ...currentUser, role });
                }

                return { success: true, role };
            }

            return {
                success: false,
                message: data.message || 'Token exchange failed'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Network error during token exchange'
            };
        }
    }

    async reExchangeToken(endpoint = '/api/auth/exchange'): Promise<{
        success: boolean;
        message?: string;
        role?: string;
    }> {
        const identityToken = this.tokens.getIdentityToken();
        if (!identityToken) {
            return { success: false, message: 'No identity token stored for re-exchange' };
        }

        const currentAccessToken = this.tokens.getAccessToken();
        this.tokens.setAccessToken(identityToken);

        const result = await this.exchangeToken(endpoint);

        if (!result.success && currentAccessToken) {
            this.tokens.setAccessToken(currentAccessToken);
        }

        return result;
    }

    needsTokenExchange(): boolean {
        const accessToken = this.tokens.getAccessToken();
        if (!accessToken) return false;

        const claims = this.tokens.decodeJwtPayload(accessToken);
        return !claims?.role;
    }

    // ── Multi-tenant operations ───────────────────────────────────────────────

    async getTenantMemberships(serverName?: string): Promise<{ memberships: TenantMembership[] }> {
        if (!this.plugin.getTenantMemberships) return { memberships: [] };
        const memberships = await this.plugin.getTenantMemberships(this.tokens.getAccessToken());
        return { memberships };
    }

    async selectTenant(tenantId: string, serverName?: string): Promise<{
        success: boolean;
        message?: string;
        access_token?: string;
    }> {
        if (!this.plugin.selectTenant) {
            return { success: false, message: 'selectTenant not supported by the configured auth plugin' };
        }
        const result = await this.plugin.selectTenant(tenantId, this.tokens.getAccessToken());
        if (result.success && result.accessToken) {
            this.tokens.setAccessToken(result.accessToken);
        }
        return { success: result.success, message: result.message, access_token: result.accessToken };
    }

    async checkTenantSlugAvailable(slug: string, serverName?: string): Promise<{
        available: boolean;
        suggestion?: string;
    }> {
        if (!this.plugin.checkTenantSlugAvailable) return { available: true };
        return this.plugin.checkTenantSlugAvailable(slug);
    }

    async checkOnboardingStatus(identityId: string, serverName?: string): Promise<any> {
        if (!this.plugin.checkOnboardingStatus) throw new Error('checkOnboardingStatus not supported');
        return this.plugin.checkOnboardingStatus(identityId);
    }

    // ── Multi-server (delegated to plugin) ────────────────────────────────────

    public getAvailableAuthServers(): string[] {
        return this.plugin.getAvailableServers?.() ?? [];
    }

    public getActiveAuthServer(): string | null {
        return this.plugin.getActiveServer?.() ?? null;
    }

    public switchAuthServer(serverName: string): void {
        if (!this.plugin.switchServer) {
            throw new Error('Multi-server mode not supported by the configured auth plugin');
        }
        this.plugin.switchServer(serverName);
    }

    public getAuthServerConfig(serverName?: string): any | null {
        return this.plugin.getServerConfig?.(serverName) ?? null;
    }

    public isMultiServerMode(): boolean {
        return (this.plugin.getAvailableServers?.() ?? []).length > 0;
    }

    // ── Backward compatibility (BehaviorSubject-style observable) ─────────────

    /**
     * @deprecated Use the `user` signal directly with toObservable() if needed.
     * Example: `toObservable(authService.user)`
     */
    get user$() {
        // For backward compatibility, create an observable-like getter
        // Consumers should migrate to signals
        return {
            subscribe: (observer: { next: (user: User | null) => void }) => {
                // Immediately emit current value
                observer.next(this.user());
                // Note: This doesn't provide reactive updates like a real Observable
                // Consumers should migrate to signals for reactive updates
                return { unsubscribe: () => {} };
            }
        };
    }

    /** @deprecated Use getCurrentUser()?.user_id instead */
    getUserId(): number { return this.user()?.user_id || 0; }

    /** @deprecated Use getCurrentUser()?.display_name instead */
    getUserName(): string { return this.user()?.display_name || ''; }

    /** @deprecated Use getCurrentUser()?.photo_url instead */
    getPhotoUrl(): string { return this.user()?.photo_url || ''; }

    /** @deprecated Use getCurrentUser()?.display_name instead */
    getDisplayName(): string { return this.user()?.display_name || ''; }

    /** @deprecated Use `/profile/${getCurrentUser()?.user_id}` instead */
    getProfileUrl(): string {
        const userId = this.user()?.user_id;
        return userId ? `/profile/${userId}` : '';
    }

    /** @deprecated Use isAuthenticated() instead */
    async signin(): Promise<boolean> { return this.isAuthenticated(); }

    /** @deprecated Use loginWithEmail() instead */
    async verifyCredentials(email: string, password: string): Promise<boolean> {
        const result = await this.loginWithEmail(email, password);
        return result.success;
    }

    /** @deprecated Check user.is_email_verified from getCurrentUser() instead */
    isSigninEmailValid(): boolean { return this.user()?.is_email_verified || false; }

    /** @deprecated No longer needed */
    onDialogClose(): void { }

    /** @deprecated No longer needed */
    closeSocialAuthDialog(): void { }

}
