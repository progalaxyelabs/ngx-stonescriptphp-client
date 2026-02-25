import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { MyEnvironmentModel, AuthServerConfig, OAuthProviderConfig } from './my-environment.model';

export type BuiltInProvider = 'google' | 'linkedin' | 'apple' | 'microsoft' | 'github' | 'zoho' | 'emailPassword';

/**
 * Authentication provider identifier.
 * Includes all built-in providers plus any custom string identifier.
 * The (string & {}) trick preserves autocomplete for built-in values.
 */
export type AuthProvider = BuiltInProvider | (string & {});

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
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly USER_STORAGE_KEY = 'progalaxyapi_user';
    private readonly ACTIVE_AUTH_SERVER_KEY = 'progalaxyapi_active_auth_server';

    // Observable user state
    private userSubject = new BehaviorSubject<User | null>(null);
    public user$: Observable<User | null> = this.userSubject.asObservable();

    // Current active auth server name (for multi-server mode)
    private activeAuthServer: string | null = null;

    constructor(
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel
    ) {
        // Restore user from localStorage on initialization
        this.restoreUser();
        // Restore active auth server
        this.restoreActiveAuthServer();
    }

    // ===== Multi-Server Support Methods =====

    /**
     * Get the current accounts URL based on configuration
     * Supports both single-server (accountsUrl) and multi-server (authServers) modes
     * @param serverName - Optional server name for multi-server mode
     */
    private getAccountsUrl(serverName?: string): string {
        // Multi-server mode
        if (this.environment.authServers && Object.keys(this.environment.authServers).length > 0) {
            const targetServer = serverName || this.activeAuthServer || this.getDefaultAuthServer();

            if (!targetServer) {
                throw new Error('No auth server specified and no default server configured');
            }

            const serverConfig = this.environment.authServers[targetServer];
            if (!serverConfig) {
                throw new Error(`Auth server '${targetServer}' not found in configuration`);
            }

            return serverConfig.url;
        }

        // Single-server mode (backward compatibility)
        if (this.environment.accountsUrl) {
            return this.environment.accountsUrl;
        }

        throw new Error('No authentication server configured. Set either accountsUrl or authServers in environment config.');
    }

    /**
     * Get the default auth server name
     */
    private getDefaultAuthServer(): string | null {
        if (!this.environment.authServers) {
            return null;
        }

        // Find server marked as default
        for (const [name, config] of Object.entries(this.environment.authServers)) {
            if (config.default) {
                return name;
            }
        }

        // If no default is marked, use the first server
        const firstServer = Object.keys(this.environment.authServers)[0];
        return firstServer || null;
    }

    /**
     * Restore active auth server from localStorage
     */
    private restoreActiveAuthServer(): void {
        try {
            const savedServer = localStorage.getItem(this.ACTIVE_AUTH_SERVER_KEY);
            if (savedServer && this.environment.authServers?.[savedServer]) {
                this.activeAuthServer = savedServer;
            } else {
                // Set to default if saved server is invalid
                this.activeAuthServer = this.getDefaultAuthServer();
            }
        } catch (error) {
            console.error('Failed to restore active auth server:', error);
            this.activeAuthServer = this.getDefaultAuthServer();
        }
    }

    /**
     * Save active auth server to localStorage
     */
    private saveActiveAuthServer(serverName: string): void {
        try {
            localStorage.setItem(this.ACTIVE_AUTH_SERVER_KEY, serverName);
            this.activeAuthServer = serverName;
        } catch (error) {
            console.error('Failed to save active auth server:', error);
        }
    }

    /**
     * Get available auth servers
     * @returns Array of server names or empty array if using single-server mode
     */
    public getAvailableAuthServers(): string[] {
        if (!this.environment.authServers) {
            return [];
        }
        return Object.keys(this.environment.authServers);
    }

    /**
     * Get current active auth server name
     * @returns Server name or null if using single-server mode
     */
    public getActiveAuthServer(): string | null {
        return this.activeAuthServer;
    }

    /**
     * Switch to a different auth server
     * @param serverName - Name of the server to switch to
     * @throws Error if server not found in configuration
     */
    public switchAuthServer(serverName: string): void {
        if (!this.environment.authServers) {
            throw new Error('Multi-server mode not configured. Use authServers in environment config.');
        }

        if (!this.environment.authServers[serverName]) {
            throw new Error(`Auth server '${serverName}' not found in configuration`);
        }

        this.saveActiveAuthServer(serverName);
    }

    /**
     * Get auth server configuration
     * @param serverName - Optional server name (uses active server if not specified)
     */
    public getAuthServerConfig(serverName?: string): AuthServerConfig | null {
        if (!this.environment.authServers) {
            return null;
        }

        const targetServer = serverName || this.activeAuthServer || this.getDefaultAuthServer();
        if (!targetServer) {
            return null;
        }

        return this.environment.authServers[targetServer] || null;
    }

    /**
     * Check if multi-server mode is enabled
     */
    public isMultiServerMode(): boolean {
        return !!(this.environment.authServers && Object.keys(this.environment.authServers).length > 0);
    }

    /**
     * Get the platform's own API base URL
     * Used for routes that go through the platform API proxy (e.g. register-tenant)
     * @throws Error if no API URL is configured
     */
    private getPlatformApiUrl(): string {
        if (this.environment.apiUrl) {
            return this.environment.apiUrl;
        }
        if (this.environment.apiServer?.host) {
            return this.environment.apiServer.host;
        }
        throw new Error('No platform API URL configured. Set apiUrl in environment config.');
    }

    /**
     * Hash UUID to numeric ID for backward compatibility
     * Converts UUID string to a consistent numeric ID for legacy code
     */
    private hashUUID(uuid: string): number {
        let hash = 0;
        for (let i = 0; i < uuid.length; i++) {
            const char = uuid.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Restore user from localStorage
     */
    private restoreUser(): void {
        try {
            const userJson = localStorage.getItem(this.USER_STORAGE_KEY);
            if (userJson) {
                const user = JSON.parse(userJson);
                this.updateUser(user);
            }
        } catch (error) {
            console.error('Failed to restore user from localStorage:', error);
        }
    }

    /**
     * Save user to localStorage
     */
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

    /**
     * Update user subject and persist to localStorage
     */
    private updateUser(user: User | null): void {
        this.userSubject.next(user);
        this.saveUser(user);
    }

    /**
     * Login with email and password
     * @param email - User email
     * @param password - User password
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithEmail(email: string, password: string, serverName?: string): Promise<AuthResult> {
        try {
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/login`,
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

                // Normalize user object to handle both response formats
                const normalizedUser: User = {
                    user_id: data.user.user_id ?? (data.user.id ? this.hashUUID(data.user.id) : 0),
                    id: data.user.id ?? String(data.user.user_id),
                    email: data.user.email,
                    display_name: data.user.display_name ?? data.user.email.split('@')[0],
                    photo_url: data.user.photo_url,
                    is_email_verified: data.user.is_email_verified ?? false
                };

                this.updateUser(normalizedUser);

                return { success: true, user: normalizedUser };
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
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithGoogle(serverName?: string): Promise<AuthResult> {
        return this.loginWithOAuth('google', serverName);
    }

    /**
     * Login with GitHub OAuth (popup window)
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithGitHub(serverName?: string): Promise<AuthResult> {
        return this.loginWithOAuth('github', serverName);
    }

    /**
     * Login with LinkedIn OAuth (popup window)
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithLinkedIn(serverName?: string): Promise<AuthResult> {
        return this.loginWithOAuth('linkedin', serverName);
    }

    /**
     * Login with Apple OAuth (popup window)
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithApple(serverName?: string): Promise<AuthResult> {
        return this.loginWithOAuth('apple', serverName);
    }

    /**
     * Login with Microsoft OAuth (popup window)
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithMicrosoft(serverName?: string): Promise<AuthResult> {
        return this.loginWithOAuth('microsoft', serverName);
    }

    /**
     * Login with Zoho OAuth (popup window)
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithZoho(serverName?: string): Promise<AuthResult> {
        return this.loginWithOAuth('zoho', serverName);
    }

    /**
     * Generic provider-based login (supports all OAuth providers)
     * @param provider - The provider identifier
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async loginWithProvider(provider: AuthProvider, serverName?: string): Promise<AuthResult> {
        if (provider === 'emailPassword') {
            throw new Error('Use loginWithEmail() for email/password authentication');
        }
        return this.loginWithOAuth(provider, serverName);
    }

    /**
     * Generic OAuth login handler
     * Opens popup window and listens for postMessage
     * @param provider - OAuth provider name
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    private async loginWithOAuth(provider: string, serverName?: string): Promise<AuthResult> {
        return new Promise((resolve) => {
            const width = 500;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const accountsUrl = this.getAccountsUrl(serverName);
            const oauthUrl = `${accountsUrl}/oauth/${provider}?` +
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
                if (event.origin !== new URL(accountsUrl).origin) {
                    return;
                }

                if (event.data.type === 'oauth_success') {
                    this.tokens.setAccessToken(event.data.access_token);
                    this.signinStatus.setSigninStatus(true);

                    // Normalize user object to handle both response formats
                    const normalizedUser: User = {
                        user_id: event.data.user.user_id ?? (event.data.user.id ? this.hashUUID(event.data.user.id) : 0),
                        id: event.data.user.id ?? String(event.data.user.user_id),
                        email: event.data.user.email,
                        display_name: event.data.user.display_name ?? event.data.user.email.split('@')[0],
                        photo_url: event.data.user.photo_url,
                        is_email_verified: event.data.user.is_email_verified ?? false
                    };

                    this.updateUser(normalizedUser);

                    window.removeEventListener('message', messageHandler);
                    popup.close();

                    resolve({
                        success: true,
                        user: normalizedUser
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
     * @param email - User email
     * @param password - User password
     * @param displayName - Display name
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async register(
        email: string,
        password: string,
        displayName: string,
        serverName?: string
    ): Promise<AuthResult> {
        try {
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/register`,
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

                // Normalize user object to handle both response formats
                const normalizedUser: User = {
                    user_id: data.user.user_id ?? (data.user.id ? this.hashUUID(data.user.id) : 0),
                    id: data.user.id ?? String(data.user.user_id),
                    email: data.user.email,
                    display_name: data.user.display_name ?? data.user.email.split('@')[0],
                    photo_url: data.user.photo_url,
                    is_email_verified: data.user.is_email_verified ?? false
                };

                this.updateUser(normalizedUser);

                return {
                    success: true,
                    user: normalizedUser,
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
     * @param serverName - Optional: Specify which auth server to logout from (for multi-server mode)
     */
    async signout(serverName?: string): Promise<void> {
        try {
            const refreshToken = this.tokens.getRefreshToken();
            if (refreshToken) {
                const accountsUrl = this.getAccountsUrl(serverName);
                await fetch(
                    `${accountsUrl}/api/auth/logout`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            refresh_token: refreshToken
                        })
                    }
                );
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
        } finally {
            this.tokens.clear();
            this.signinStatus.setSigninStatus(false);
            this.updateUser(null);
        }
    }

    /**
     * Check for active session (call on app init)
     * @param serverName - Optional: Specify which auth server to check (for multi-server mode)
     */
    async checkSession(serverName?: string): Promise<boolean> {
        if (this.tokens.hasValidAccessToken()) {
            this.signinStatus.setSigninStatus(true);
            return true;
        }

        // Try to refresh using httpOnly cookie
        try {
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/refresh`,
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

                // Normalize user object to handle both response formats
                if (data.user) {
                    const normalizedUser: User = {
                        user_id: data.user.user_id ?? (data.user.id ? this.hashUUID(data.user.id) : 0),
                        id: data.user.id ?? String(data.user.user_id),
                        email: data.user.email,
                        display_name: data.user.display_name ?? data.user.email.split('@')[0],
                        photo_url: data.user.photo_url,
                        is_email_verified: data.user.is_email_verified ?? false
                    };
                    this.updateUser(normalizedUser);
                }

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

            // Email/password registration — route through platform API proxy
            const apiUrl = this.getPlatformApiUrl();
            const response = await fetch(
                `${apiUrl}/auth/register-tenant`,
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
                    // Normalize user object to handle both response formats
                    const normalizedUser: User = {
                        user_id: result.user.user_id ?? (result.user.id ? this.hashUUID(result.user.id) : 0),
                        id: result.user.id ?? String(result.user.user_id),
                        email: result.user.email,
                        display_name: result.user.display_name ?? result.user.email.split('@')[0],
                        photo_url: result.user.photo_url,
                        is_email_verified: result.user.is_email_verified ?? false
                    };
                    this.updateUser(normalizedUser);
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
            const accountsUrl = this.getAccountsUrl();
            const oauthUrl = `${accountsUrl}/oauth/${provider}?` +
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
                if (event.origin !== new URL(accountsUrl).origin) {
                    return;
                }

                if (event.data.type === 'tenant_register_success') {
                    // Set tokens and user
                    if (event.data.access_token) {
                        this.tokens.setAccessToken(event.data.access_token);
                        this.signinStatus.setSigninStatus(true);
                    }
                    if (event.data.user) {
                        // Normalize user object to handle both response formats
                        const normalizedUser: User = {
                            user_id: event.data.user.user_id ?? (event.data.user.id ? this.hashUUID(event.data.user.id) : 0),
                            id: event.data.user.id ?? String(event.data.user.user_id),
                            email: event.data.user.email,
                            display_name: event.data.user.display_name ?? event.data.user.email.split('@')[0],
                            photo_url: event.data.user.photo_url,
                            is_email_verified: event.data.user.is_email_verified ?? false
                        };
                        this.updateUser(normalizedUser);
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
     * @param serverName - Optional: Specify which auth server to query (for multi-server mode)
     */
    async getTenantMemberships(serverName?: string): Promise<{
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
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/memberships`,
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
     * @param tenantId - Tenant ID to select
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async selectTenant(tenantId: string, serverName?: string): Promise<{
        success: boolean;
        message?: string;
        access_token?: string;
    }> {
        try {
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/select-tenant`,
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
     * @param slug - Tenant slug to check
     * @param serverName - Optional: Specify which auth server to query (for multi-server mode)
     */
    async checkTenantSlugAvailable(slug: string, serverName?: string): Promise<{
        available: boolean;
        suggestion?: string;
    }> {
        try {
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/check-tenant-slug/${slug}`,
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
    async getUserProfile(email: string, serverName?: string): Promise<User | null> {
        try {
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/check-email`,
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

    /**
     * Check if user has completed onboarding (has a tenant)
     * @param identityId - User identity ID
     * @param serverName - Optional: Specify which auth server to query (for multi-server mode)
     */
    async checkOnboardingStatus(identityId: string, serverName?: string): Promise<{
        onboarded: boolean;
        tenant_slug?: string;
        tenant_name?: string;
        role?: string;
    }> {
        try {
            const accountsUrl = this.getAccountsUrl(serverName);
            const response = await fetch(
                `${accountsUrl}/api/auth/onboarding/status?platform_code=${this.environment.platformCode}&identity_id=${identityId}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                throw new Error('Failed to check onboarding status');
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Complete tenant onboarding (create tenant with country + org name)
     * @param countryCode - Country code
     * @param tenantName - Tenant organization name
     * @param serverName - Optional: Specify which auth server to use (for multi-server mode)
     */
    async completeTenantOnboarding(countryCode: string, tenantName: string, serverName?: string): Promise<{
        tenant: {
            id: string;
            slug: string;
            name: string;
        };
        access_token: string;
        refresh_token: string;
    }> {
        try {
            const accessToken = this.tokens.getAccessToken();
            if (!accessToken) {
                throw new Error('Not authenticated');
            }

            // Route through platform API proxy — PHP API adds platform_secret header
            const apiUrl = this.getPlatformApiUrl();
            const response = await fetch(
                `${apiUrl}/auth/register-tenant`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        platform: this.environment.platformCode,
                        tenant_name: tenantName,
                        country_code: countryCode,
                        provider: 'google', // Assuming OAuth
                        oauth_token: accessToken
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create tenant');
            }

            const data = await response.json();

            // Update tokens with new tenant-scoped tokens
            if (data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                this.signinStatus.setSigninStatus(true);
            }

            return data;
        } catch (error) {
            throw error;
        }
    }
}
