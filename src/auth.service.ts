import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { MyEnvironmentModel } from './my-environment.model';
import { AUTH_PLUGIN, AuthPlugin, AuthResult, OtpSendResponse, OtpVerifyResponse, TenantMembership, User } from './auth.plugin';

// Re-export types for backward compatibility
export type { AuthResult, TenantMembership, User };
export type { AuthPlugin };

export type BuiltInProvider = 'google' | 'linkedin' | 'apple' | 'microsoft' | 'github' | 'zoho' | 'emailPassword';

/**
 * Authentication provider identifier.
 * Includes all built-in providers plus any custom string identifier.
 * The (string & {}) trick preserves autocomplete for built-in values.
 */
export type AuthProvider = BuiltInProvider | (string & {});

/**
 * AuthService — manages auth state and delegates all auth operations to the AuthPlugin.
 *
 * This service holds user state (via BehaviorSubject) and tokens (via TokenService).
 * It does not make any HTTP calls directly — all auth logic lives in the plugin.
 *
 * Provide a plugin via provideNgxStoneScriptPhpClient():
 * - Default: StoneScriptPHPAuth (built-in, matches StoneScriptPHP backend)
 * - External: any class implementing AuthPlugin (Firebase, progalaxyelabs-auth, Okta, etc.)
 */
@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly USER_STORAGE_KEY = 'progalaxyapi_user';

    private userSubject = new BehaviorSubject<User | null>(null);
    public user$: Observable<User | null> = this.userSubject.asObservable();

    constructor(
        @Inject(AUTH_PLUGIN) private plugin: AuthPlugin,
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        private environment: MyEnvironmentModel,
        private router: Router
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
        this.userSubject.next(user);
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
        this.signinStatus.setSigninStatus(true);
    }

    /**
     * Decode the access token and attach the `role` claim to the user object.
     * Falls back to role from the membership field in the AuthResult if no JWT role found.
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
        if (result.success) this.storeAuthResult(result);
        return result;
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
        this.signinStatus.setSigninStatus(false);
        this.updateUser(null);
    }

    /**
     * Clear the local session immediately without hitting the server logout endpoint.
     * Called when the API returns 401 after a token refresh — meaning the session is
     * no longer valid server-side (e.g. tenant deleted, token revoked).
     * Clears tokens, resets user state, and redirects to /login.
     */
    clearSession(loginRoute: string = '/login'): void {
        this.tokens.clear();
        this.updateUser(null);
        this.signinStatus.setSigninStatus(false);
        this.router.navigate([loginRoute], { replaceUrl: true });
    }

    async checkSession(serverName?: string): Promise<boolean> {
        if (this.tokens.hasValidAccessToken()) {
            // If we already have a stored user, update their role from the current JWT
            const storedUser = this.getCurrentUser();
            if (storedUser && !storedUser.role) {
                const enriched = this.enrichUserWithJwtRole(storedUser);
                if (enriched.role) this.updateUser(enriched);
            }
            this.signinStatus.setSigninStatus(true);
            return true;
        }
        const result = await this.plugin.checkSession();
        if (result.success && result.accessToken) {
            this.tokens.setAccessToken(result.accessToken);
            if (result.user) {
                this.updateUser(this.enrichUserWithJwtRole(result.user, result.accessToken));
            }
            this.signinStatus.setSigninStatus(true);
            return true;
        }
        this.tokens.clear();
        this.updateUser(null);
        this.signinStatus.setSigninStatus(false);
        return false;
    }

    /**
     * Refresh the access token. Called by ApiConnectionService on 401.
     * @returns true if token was refreshed, false if refresh failed (user is signed out)
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
        this.signinStatus.signedOut();
        return false;
    }

    isAuthenticated(): boolean {
        return this.tokens.hasValidAccessToken();
    }

    // ── Profile management ────────────────────────────────────────────────────

    /**
     * Update the authenticated user's display name.
     * Calls PUT /api/account/profile with { display_name } and updates local user state on success.
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
        return this.userSubject.value;
    }

    // ── OTP authentication ─────────────────────────────────────────────────────

    async sendOtp(identifier: string, mode?: 'login' | 'signup'): Promise<OtpSendResponse> {
        if (!this.plugin.sendOtp) {
            return { success: false, identifier_type: 'email', masked_identifier: '', expires_in: 0, resend_after: 0 };
        }
        return this.plugin.sendOtp(identifier, mode);
    }

    async verifyOtp(identifier: string, code: string): Promise<OtpVerifyResponse> {
        if (!this.plugin.verifyOtp) {
            return { success: false, verified_token: '' };
        }
        return this.plugin.verifyOtp(identifier, code);
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

    // ── Token exchange (for platform-owned roles) ──────────────────────────────

    /**
     * Exchange identity token for platform token.
     *
     * In the platform-owned roles architecture:
     * 1. Auth service issues identity-only token (no roles)
     * 2. Frontend exchanges identity token with platform API
     * 3. Platform API returns platform token with roles from tenant DB
     * 4. Platform token is used for subsequent API calls
     *
     * @param endpoint - Platform API endpoint for token exchange (default: '/api/auth/exchange')
     * @returns { success, message?, role? } - Result of the exchange
     *
     * After successful exchange:
     * - Platform token is stored as the main access token
     * - Identity token is preserved for potential re-exchange
     * - Role is extracted from platform token and attached to user
     */
    async exchangeToken(endpoint = '/api/auth/exchange'): Promise<{
        success: boolean;
        message?: string;
        role?: string;
    }> {
        const identityToken = this.tokens.getAccessToken()
        if (!identityToken) {
            return { success: false, message: 'No identity token available' }
        }

        try {
            const host = this.environment.apiServer.host
            const response = await fetch(`${host}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${identityToken}`
                },
                body: JSON.stringify({})
            })

            const data = await response.json()

            if (data.status === 'ok' && data.data?.access_token) {
                // Store identity token separately before replacing access token
                this.tokens.setIdentityToken(identityToken)

                // Platform token becomes the main access token
                this.tokens.setAccessToken(data.data.access_token)

                // If platform token includes refresh token, update it
                if (data.data.refresh_token) {
                    this.tokens.setRefreshToken(data.data.refresh_token)
                }

                // Extract role from platform token and update user
                const claims = this.tokens.decodeJwtPayload(data.data.access_token)
                const role = claims?.role || data.data.role

                const currentUser = this.getCurrentUser()
                if (currentUser && role) {
                    this.updateUser({ ...currentUser, role })
                }

                return { success: true, role }
            }

            return {
                success: false,
                message: data.message || 'Token exchange failed'
            }
        } catch (error) {
            return {
                success: false,
                message: 'Network error during token exchange'
            }
        }
    }

    /**
     * Re-exchange token using stored identity token.
     * Useful when switching roles or tenant within the same session.
     */
    async reExchangeToken(endpoint = '/api/auth/exchange'): Promise<{
        success: boolean;
        message?: string;
        role?: string;
    }> {
        const identityToken = this.tokens.getIdentityToken()
        if (!identityToken) {
            return { success: false, message: 'No identity token stored for re-exchange' }
        }

        // Temporarily restore identity token as access token
        const currentAccessToken = this.tokens.getAccessToken()
        this.tokens.setAccessToken(identityToken)

        const result = await this.exchangeToken(endpoint)

        // If exchange failed, restore previous access token
        if (!result.success && currentAccessToken) {
            this.tokens.setAccessToken(currentAccessToken)
        }

        return result
    }

    /**
     * Check if token exchange is needed.
     * Returns true if we have an identity token but the current access token
     * doesn't contain a role claim (indicating it's an identity-only token).
     */
    needsTokenExchange(): boolean {
        const accessToken = this.tokens.getAccessToken()
        if (!accessToken) return false

        const claims = this.tokens.decodeJwtPayload(accessToken)
        // If no role in JWT, token exchange is needed
        return !claims?.role
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

    // ── Backward compatibility ────────────────────────────────────────────────

    /** @deprecated Use getCurrentUser()?.user_id instead */
    getUserId(): number { return this.userSubject.value?.user_id || 0; }

    /** @deprecated Use getCurrentUser()?.display_name instead */
    getUserName(): string { return this.userSubject.value?.display_name || ''; }

    /** @deprecated Use getCurrentUser()?.photo_url instead */
    getPhotoUrl(): string { return this.userSubject.value?.photo_url || ''; }

    /** @deprecated Use getCurrentUser()?.display_name instead */
    getDisplayName(): string { return this.userSubject.value?.display_name || ''; }

    /** @deprecated Use `/profile/${getCurrentUser()?.user_id}` instead */
    getProfileUrl(): string {
        const userId = this.userSubject.value?.user_id;
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
    isSigninEmailValid(): boolean { return this.userSubject.value?.is_email_verified || false; }

    /** @deprecated No longer needed */
    onDialogClose(): void { }

    /** @deprecated No longer needed */
    closeSocialAuthDialog(): void { }

    /** @deprecated Use checkEmail() from the plugin directly */
    async getUserProfile(email: string, serverName?: string): Promise<User | null> {
        if (!this.plugin.checkEmail) return null;
        const result = await this.plugin.checkEmail(email);
        return result.exists ? result.user : null;
    }
}
