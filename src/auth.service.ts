import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { MyEnvironmentModel } from './my-environment.model';

export type AuthProvider = 'google' | 'linkedin' | 'apple' | 'microsoft' | 'github' | 'emailPassword';

export interface User {
    user_id: number;
    email: string;
    display_name: string;
    photo_url?: string;
    is_email_verified: boolean;
}

export interface AuthResult {
    success: boolean;
    message?: string;
    user?: User;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    // Observable user state
    private userSubject = new BehaviorSubject<User | null>(null);
    public user$: Observable<User | null> = this.userSubject.asObservable();

    constructor(
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel
    ) { }

    /**
     * Login with email and password
     */
    async loginWithEmail(email: string, password: string): Promise<AuthResult> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/login`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // Include cookies for refresh token
                    body: JSON.stringify({
                        email,
                        password,
                        platform: this.environment.platformCode
                    })
                }
            );

            const data = await response.json();

            if (data.success && data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                this.signinStatus.setSigninStatus(true);
                this.userSubject.next(data.user);

                return { success: true, user: data.user };
            }

            return {
                success: false,
                message: data.message || 'Invalid credentials'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Network error. Please try again.'
            };
        }
    }

    /**
     * Login with Google OAuth (popup window)
     */
    async loginWithGoogle(): Promise<AuthResult> {
        return this.loginWithOAuth('google');
    }

    /**
     * Login with GitHub OAuth (popup window)
     */
    async loginWithGitHub(): Promise<AuthResult> {
        return this.loginWithOAuth('github');
    }

    /**
     * Login with LinkedIn OAuth (popup window)
     */
    async loginWithLinkedIn(): Promise<AuthResult> {
        return this.loginWithOAuth('linkedin');
    }

    /**
     * Login with Apple OAuth (popup window)
     */
    async loginWithApple(): Promise<AuthResult> {
        return this.loginWithOAuth('apple');
    }

    /**
     * Login with Microsoft OAuth (popup window)
     */
    async loginWithMicrosoft(): Promise<AuthResult> {
        return this.loginWithOAuth('microsoft');
    }

    /**
     * Generic provider-based login (supports all OAuth providers)
     * @param provider - The provider identifier
     */
    async loginWithProvider(provider: AuthProvider): Promise<AuthResult> {
        if (provider === 'emailPassword') {
            throw new Error('Use loginWithEmail() for email/password authentication');
        }
        return this.loginWithOAuth(provider);
    }

    /**
     * Generic OAuth login handler
     * Opens popup window and listens for postMessage
     */
    private async loginWithOAuth(provider: string): Promise<AuthResult> {
        return new Promise((resolve) => {
            const width = 500;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const oauthUrl = `${this.environment.accountsUrl}/oauth/${provider}?` +
                `platform=${this.environment.platformCode}&` +
                `mode=popup`;

            const popup = window.open(
                oauthUrl,
                `${provider}_login`,
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup) {
                resolve({
                    success: false,
                    message: 'Popup blocked. Please allow popups for this site.'
                });
                return;
            }

            // Listen for message from popup
            const messageHandler = (event: MessageEvent) => {
                // Verify origin
                if (event.origin !== new URL(this.environment.accountsUrl).origin) {
                    return;
                }

                if (event.data.type === 'oauth_success') {
                    this.tokens.setAccessToken(event.data.access_token);
                    this.signinStatus.setSigninStatus(true);
                    this.userSubject.next(event.data.user);

                    window.removeEventListener('message', messageHandler);
                    popup.close();

                    resolve({
                        success: true,
                        user: event.data.user
                    });
                } else if (event.data.type === 'oauth_error') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();

                    resolve({
                        success: false,
                        message: event.data.message || 'OAuth login failed'
                    });
                }
            };

            window.addEventListener('message', messageHandler);

            // Check if popup was closed manually
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    resolve({
                        success: false,
                        message: 'Login cancelled'
                    });
                }
            }, 500);
        });
    }

    /**
     * Register new user
     */
    async register(
        email: string,
        password: string,
        displayName: string
    ): Promise<AuthResult> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/register`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email,
                        password,
                        display_name: displayName,
                        platform: this.environment.platformCode
                    })
                }
            );

            const data = await response.json();

            if (data.success && data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                this.signinStatus.setSigninStatus(true);
                this.userSubject.next(data.user);

                return {
                    success: true,
                    user: data.user,
                    message: data.needs_verification ? 'Please verify your email' : undefined
                };
            }

            return {
                success: false,
                message: data.message || 'Registration failed'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Network error. Please try again.'
            };
        }
    }

    /**
     * Sign out user
     */
    async signout(): Promise<void> {
        try {
            await fetch(
                `${this.environment.accountsUrl}/api/auth/logout`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );
        } catch (error) {
            console.error('Logout API call failed:', error);
        } finally {
            this.tokens.clear();
            this.signinStatus.setSigninStatus(false);
            this.userSubject.next(null);
        }
    }

    /**
     * Check for active session (call on app init)
     */
    async checkSession(): Promise<boolean> {
        if (this.tokens.hasValidAccessToken()) {
            this.signinStatus.setSigninStatus(true);
            return true;
        }

        // Try to refresh using httpOnly cookie
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/refresh`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                this.signinStatus.setSigninStatus(false);
                return false;
            }

            const data = await response.json();

            if (data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                this.userSubject.next(data.user);
                this.signinStatus.setSigninStatus(true);
                return true;
            }

            return false;
        } catch (error) {
            this.signinStatus.setSigninStatus(false);
            return false;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.tokens.hasValidAccessToken();
    }

    /**
     * Get current user (synchronous)
     */
    getCurrentUser(): User | null {
        return this.userSubject.value;
    }

    // ===== Multi-Tenant Methods =====

    /**
     * Register a new user AND create a new tenant (organization)
     * This is used when a user wants to create their own organization
     */
    async registerTenant(data: {
        tenantName: string;
        tenantSlug: string;
        displayName?: string;
        email?: string;
        password?: string;
        provider: AuthProvider;
    }): Promise<{
        success: boolean;
        message?: string;
        tenant?: { id: string; name: string; slug: string };
        user?: { id: string; email: string; name: string };
        access_token?: string;
    }> {
        try {
            // If using OAuth, initiate OAuth flow first
            if (data.provider !== 'emailPassword') {
                return await this.registerTenantWithOAuth(
                    data.tenantName,
                    data.tenantSlug,
                    data.provider
                );
            }

            // Email/password registration
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/register-tenant`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        platform: this.environment.platformCode,
                        tenant_name: data.tenantName,
                        tenant_slug: data.tenantSlug,
                        display_name: data.displayName,
                        email: data.email,
                        password: data.password,
                        provider: 'emailPassword'
                    })
                }
            );

            const result = await response.json();

            if (result.success && result.access_token) {
                this.tokens.setAccessToken(result.access_token);
                this.signinStatus.setSigninStatus(true);
                if (result.user) {
                    this.userSubject.next(result.user);
                }
            }

            return result;
        } catch (error) {
            return {
                success: false,
                message: 'Network error. Please try again.'
            };
        }
    }

    /**
     * Register tenant with OAuth provider
     * Opens popup window for OAuth flow
     */
    private async registerTenantWithOAuth(
        tenantName: string,
        tenantSlug: string,
        provider: AuthProvider
    ): Promise<{
        success: boolean;
        message?: string;
        tenant?: { id: string; name: string; slug: string };
        user?: { id: string; email: string; name: string };
    }> {
        return new Promise((resolve) => {
            const width = 500;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            // Build OAuth URL with tenant registration params
            const oauthUrl = `${this.environment.accountsUrl}/oauth/${provider}?` +
                `platform=${this.environment.platformCode}&` +
                `mode=popup&` +
                `action=register_tenant&` +
                `tenant_name=${encodeURIComponent(tenantName)}&` +
                `tenant_slug=${encodeURIComponent(tenantSlug)}`;

            const popup = window.open(
                oauthUrl,
                `${provider}_register_tenant`,
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup) {
                resolve({
                    success: false,
                    message: 'Popup blocked. Please allow popups for this site.'
                });
                return;
            }

            // Listen for message from popup
            const messageHandler = (event: MessageEvent) => {
                // Verify origin
                if (event.origin !== new URL(this.environment.accountsUrl).origin) {
                    return;
                }

                if (event.data.type === 'tenant_register_success') {
                    // Set tokens and user
                    if (event.data.access_token) {
                        this.tokens.setAccessToken(event.data.access_token);
                        this.signinStatus.setSigninStatus(true);
                    }
                    if (event.data.user) {
                        this.userSubject.next(event.data.user);
                    }

                    window.removeEventListener('message', messageHandler);
                    popup.close();

                    resolve({
                        success: true,
                        tenant: event.data.tenant,
                        user: event.data.user
                    });
                } else if (event.data.type === 'tenant_register_error') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();

                    resolve({
                        success: false,
                        message: event.data.message || 'Tenant registration failed'
                    });
                }
            };

            window.addEventListener('message', messageHandler);

            // Check if popup was closed manually
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    resolve({
                        success: false,
                        message: 'Registration cancelled'
                    });
                }
            }, 500);
        });
    }

    /**
     * Get all tenant memberships for the authenticated user
     */
    async getTenantMemberships(): Promise<{
        memberships: Array<{
            tenant_id: string;
            slug: string;
            name: string;
            role: string;
            status: string;
            last_accessed?: string;
        }>;
    }> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/memberships`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.tokens.getAccessToken()}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                }
            );

            const data = await response.json();
            return {
                memberships: data.memberships || []
            };
        } catch (error) {
            return { memberships: [] };
        }
    }

    /**
     * Select a tenant for the current session
     * Updates the JWT token with tenant context
     */
    async selectTenant(tenantId: string): Promise<{
        success: boolean;
        message?: string;
        access_token?: string;
    }> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/select-tenant`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.tokens.getAccessToken()}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ tenant_id: tenantId })
                }
            );

            const data = await response.json();

            if (data.success && data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                return {
                    success: true,
                    access_token: data.access_token
                };
            }

            return {
                success: false,
                message: data.message || 'Failed to select tenant'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Network error. Please try again.'
            };
        }
    }

    /**
     * Check if a tenant slug is available
     */
    async checkTenantSlugAvailable(slug: string): Promise<{
        available: boolean;
        suggestion?: string;
    }> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/check-tenant-slug/${slug}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const data = await response.json();
            return {
                available: data.available || false,
                suggestion: data.suggestion
            };
        } catch (error) {
            // On error, assume available (don't block registration)
            return { available: true };
        }
    }

    // ===== Backward Compatibility Methods =====
    // These methods are deprecated and maintained for backward compatibility
    // with existing platform code. New code should use the methods above.

    /**
     * @deprecated Use getCurrentUser()?.user_id instead
     */
    getUserId(): number {
        return this.userSubject.value?.user_id || 0;
    }

    /**
     * @deprecated Use getCurrentUser()?.display_name instead
     */
    getUserName(): string {
        return this.userSubject.value?.display_name || '';
    }

    /**
     * @deprecated Use getCurrentUser()?.photo_url instead
     */
    getPhotoUrl(): string {
        return this.userSubject.value?.photo_url || '';
    }

    /**
     * @deprecated Use getCurrentUser()?.display_name instead
     */
    getDisplayName(): string {
        return this.userSubject.value?.display_name || '';
    }

    /**
     * @deprecated Use `/profile/${getCurrentUser()?.user_id}` instead
     */
    getProfileUrl(): string {
        const userId = this.userSubject.value?.user_id;
        return userId ? `/profile/${userId}` : '';
    }

    /**
     * @deprecated Use isAuthenticated() instead
     */
    async signin(): Promise<boolean> {
        return this.isAuthenticated();
    }

    /**
     * @deprecated Use loginWithEmail() instead
     */
    async verifyCredentials(email: string, password: string): Promise<boolean> {
        const result = await this.loginWithEmail(email, password);
        return result.success;
    }

    /**
     * @deprecated Check user.is_email_verified from getCurrentUser() instead
     */
    isSigninEmailValid(): boolean {
        return this.userSubject.value?.is_email_verified || false;
    }

    /**
     * @deprecated No longer needed - dialog is managed by platform
     */
    onDialogClose(): void {
        // No-op for backward compatibility
    }

    /**
     * @deprecated No longer needed - dialog is managed by platform
     */
    closeSocialAuthDialog(): void {
        // No-op for backward compatibility
    }

    /**
     * @deprecated Check if user exists by calling /api/auth/check-email endpoint
     */
    async getUserProfile(email: string): Promise<User | null> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/check-email`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                }
            );

            const data = await response.json();
            return data.exists ? data.user : null;
        } catch (error) {
            return null;
        }
    }
}
