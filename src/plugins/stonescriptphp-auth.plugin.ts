import { AuthPlugin, AuthResult, TenantMembership, RegisterTenantData, User } from '../auth.plugin';
import { AuthResponseMap, AuthConfig, AuthServerConfig } from '../my-environment.model';

export interface StoneScriptPHPAuthConfig {
    /** Auth server base URL (e.g., 'https://accounts.progalaxyelabs.com') */
    host: string;

    /** Platform code for multi-tenant auth (e.g., 'progalaxy', 'hr') */
    platformCode?: string;

    /**
     * Named auth servers for multi-server mode.
     * When set, host is used as fallback if no default server is specified.
     */
    authServers?: Record<string, AuthServerConfig>;

    /**
     * Response field mapping for external format compatibility.
     * Defaults to StoneScriptPHP format: { status:'ok', data:{ access_token, user } }
     */
    responseMap?: Partial<AuthResponseMap>;

    /**
     * Auth mode and CSRF configuration.
     * Defaults: mode='cookie', refreshEndpoint='/auth/refresh', useCsrf=true
     */
    auth?: Pick<AuthConfig, 'mode' | 'refreshEndpoint' | 'useCsrf' | 'csrfTokenCookieName' | 'csrfHeaderName'>;

    /**
     * Platform's own API URL for register-tenant proxy route.
     * Falls back to host if not set.
     */
    apiUrl?: string;
}

const ACTIVE_SERVER_KEY = 'progalaxyapi_active_auth_server';

const DEFAULT_RESPONSE_MAP: Required<AuthResponseMap> = {
    successPath: 'status',
    successValue: 'ok',
    accessTokenPath: 'data.access_token',
    refreshTokenPath: 'data.refresh_token',
    userPath: 'data.user',
    errorMessagePath: 'message'
};

/**
 * Built-in auth plugin for StoneScriptPHP backends.
 *
 * Handles StoneScriptPHP's auth format ({ status:'ok', data:{ access_token } })
 * with optional authResponseMap overrides for external backends.
 *
 * Supports:
 * - Cookie mode (httpOnly refresh token + CSRF)
 * - Body mode (tokens in localStorage)
 * - Multi-server auth (named authServers config)
 * - OAuth popup login
 * - Multi-tenant operations
 */
export class StoneScriptPHPAuth implements AuthPlugin {
    private activeServer: string | null = null;

    constructor(private config: StoneScriptPHPAuthConfig) {
        this.restoreActiveServer();
    }

    // ── Response mapping ────────────────────────────────────────────────────

    private get responseMap(): Required<AuthResponseMap> {
        const m = this.config.responseMap;
        if (!m) return DEFAULT_RESPONSE_MAP;
        return { ...DEFAULT_RESPONSE_MAP, ...m };
    }

    private resolvePath(obj: any, path: string): any {
        return path.split('.').reduce((o, key) => o?.[key], obj);
    }

    private isAuthSuccess(data: any): boolean {
        const map = this.responseMap;
        if (map.successPath) {
            return this.resolvePath(data, map.successPath) === (map.successValue ?? 'ok');
        }
        return !!this.resolvePath(data, map.accessTokenPath);
    }

    private resolveAccessToken(data: any): string | undefined {
        return this.resolvePath(data, this.responseMap.accessTokenPath);
    }

    private resolveRefreshToken(data: any): string | undefined {
        return this.resolvePath(data, this.responseMap.refreshTokenPath);
    }

    private resolveUser(data: any): User | undefined {
        const raw = this.resolvePath(data, this.responseMap.userPath);
        return raw ? this.normalizeUser(raw) : undefined;
    }

    private resolveErrorMessage(data: any, fallback: string): string {
        const path = this.responseMap.errorMessagePath ?? 'message';
        return this.resolvePath(data, path) || fallback;
    }

    private normalizeUser(raw: any): User {
        return {
            user_id: raw.user_id ?? (raw.id ? this.hashUUID(raw.id) : 0),
            id: raw.id ?? String(raw.user_id),
            email: raw.email,
            display_name: raw.display_name ?? raw.email?.split('@')[0] ?? '',
            photo_url: raw.photo_url,
            is_email_verified: raw.is_email_verified ?? false
        };
    }

    private hashUUID(uuid: string): number {
        let hash = 0;
        for (let i = 0; i < uuid.length; i++) {
            const char = uuid.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    // ── CSRF (inlined, no Angular DI needed) ────────────────────────────────

    private getCsrfToken(): string | null {
        const cookieName = this.config.auth?.csrfTokenCookieName ?? 'csrf_token';
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === cookieName) return decodeURIComponent(value);
        }
        return null;
    }

    // ── Server resolution ────────────────────────────────────────────────────

    private getAccountsUrl(serverName?: string): string {
        if (this.config.authServers && Object.keys(this.config.authServers).length > 0) {
            const target = serverName || this.activeServer || this.getDefaultServer();
            if (!target) throw new Error('No auth server specified and no default server configured');
            const serverConfig = this.config.authServers[target];
            if (!serverConfig) throw new Error(`Auth server '${target}' not found in configuration`);
            return serverConfig.url;
        }
        return this.config.host;
    }

    private getPlatformApiUrl(): string {
        return this.config.apiUrl || this.config.host;
    }

    private getDefaultServer(): string | null {
        if (!this.config.authServers) return null;
        for (const [name, cfg] of Object.entries(this.config.authServers)) {
            if (cfg.default) return name;
        }
        return Object.keys(this.config.authServers)[0] || null;
    }

    private restoreActiveServer(): void {
        try {
            const saved = localStorage.getItem(ACTIVE_SERVER_KEY);
            this.activeServer = (saved && this.config.authServers?.[saved])
                ? saved
                : this.getDefaultServer();
        } catch {
            this.activeServer = this.getDefaultServer();
        }
    }

    // ── Multi-server public API ──────────────────────────────────────────────

    switchServer(serverName: string): void {
        if (!this.config.authServers?.[serverName]) {
            throw new Error(`Auth server '${serverName}' not found in configuration`);
        }
        try { localStorage.setItem(ACTIVE_SERVER_KEY, serverName); } catch { /* ignore */ }
        this.activeServer = serverName;
    }

    getAvailableServers(): string[] {
        return Object.keys(this.config.authServers ?? {});
    }

    getActiveServer(): string | null {
        return this.activeServer;
    }

    getServerConfig(serverName?: string): AuthServerConfig | null {
        if (!this.config.authServers) return null;
        const target = serverName || this.activeServer || this.getDefaultServer();
        return target ? (this.config.authServers[target] ?? null) : null;
    }

    // ── Core auth operations ─────────────────────────────────────────────────

    async login(email: string, password: string): Promise<AuthResult> {
        try {
            const accountsUrl = this.getAccountsUrl();
            const response = await fetch(`${accountsUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, platform: this.config.platformCode })
            });
            const data = await response.json();
            if (this.isAuthSuccess(data)) {
                return {
                    success: true,
                    accessToken: this.resolveAccessToken(data),
                    refreshToken: this.resolveRefreshToken(data),
                    user: this.resolveUser(data)
                };
            }
            return { success: false, message: this.resolveErrorMessage(data, 'Invalid credentials') };
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async register(email: string, password: string, displayName: string): Promise<AuthResult> {
        try {
            const accountsUrl = this.getAccountsUrl();
            const response = await fetch(`${accountsUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email,
                    password,
                    display_name: displayName,
                    platform: this.config.platformCode
                })
            });
            const data = await response.json();
            if (this.isAuthSuccess(data)) {
                return {
                    success: true,
                    accessToken: this.resolveAccessToken(data),
                    refreshToken: this.resolveRefreshToken(data),
                    user: this.resolveUser(data),
                    needsVerification: !!data.needs_verification,
                    message: data.needs_verification ? 'Please verify your email' : undefined
                };
            }
            return { success: false, message: this.resolveErrorMessage(data, 'Registration failed') };
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async logout(refreshToken?: string): Promise<void> {
        try {
            const accountsUrl = this.getAccountsUrl();
            await fetch(`${accountsUrl}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ refresh_token: refreshToken })
            });
        } catch (error) {
            console.error('Logout API call failed:', error);
        }
    }

    async checkSession(): Promise<AuthResult> {
        try {
            const accountsUrl = this.getAccountsUrl();
            const response = await fetch(`${accountsUrl}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!response.ok) return { success: false };
            const data = await response.json();
            const accessToken = this.resolveAccessToken(data);
            if (accessToken) {
                return { success: true, accessToken, user: this.resolveUser(data) };
            }
            return { success: false };
        } catch {
            return { success: false };
        }
    }

    async refresh(accessToken: string, refreshToken?: string): Promise<string | null> {
        const mode = this.config.auth?.mode ?? 'cookie';
        if (mode === 'none') return null;
        return mode === 'cookie'
            ? this.refreshCookieMode()
            : this.refreshBodyMode(accessToken, refreshToken);
    }

    private async refreshCookieMode(): Promise<string | null> {
        try {
            const authHost = this.getAccountsUrl();
            const endpoint = this.config.auth?.refreshEndpoint ?? '/auth/refresh';
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };

            if (this.config.auth?.useCsrf !== false) {
                const csrfToken = this.getCsrfToken();
                if (!csrfToken) {
                    console.error('CSRF token not found in cookie');
                    return null;
                }
                headers[this.config.auth?.csrfHeaderName ?? 'X-CSRF-Token'] = csrfToken;
            }

            const response = await fetch(`${authHost}${endpoint}`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'include',
                redirect: 'error',
                headers
            });
            if (!response.ok) return null;

            const data = await response.json();
            if (!this.isAuthSuccess(data)) return null;

            return this.resolveAccessToken(data) ?? null;
        } catch (error) {
            console.error('Token refresh failed (cookie mode):', error);
            return null;
        }
    }

    private async refreshBodyMode(accessToken: string, refreshToken?: string): Promise<string | null> {
        if (!refreshToken) return null;
        try {
            const authHost = this.getAccountsUrl();
            const endpoint = this.config.auth?.refreshEndpoint ?? '/user/refresh_access';
            const response = await fetch(`${authHost}${endpoint}`, {
                method: 'POST',
                mode: 'cors',
                redirect: 'error',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
            });
            if (!response.ok) return null;

            const data = await response.json();
            return this.resolveAccessToken(data) ?? null;
        } catch (error) {
            console.error('Token refresh failed (body mode):', error);
            return null;
        }
    }

    // ── OAuth ────────────────────────────────────────────────────────────────

    async loginWithProvider(provider: string): Promise<AuthResult> {
        return new Promise((resolve) => {
            const width = 500, height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const accountsUrl = this.getAccountsUrl();
            const oauthUrl = `${accountsUrl}/oauth/${provider}?platform=${this.config.platformCode}&mode=popup`;

            const popup = window.open(oauthUrl, `${provider}_login`,
                `width=${width},height=${height},left=${left},top=${top}`);

            if (!popup) {
                resolve({ success: false, message: 'Popup blocked. Please allow popups for this site.' });
                return;
            }

            const messageHandler = (event: MessageEvent) => {
                if (event.origin !== new URL(accountsUrl).origin) return;

                if (event.data.type === 'oauth_success') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    const rawUser = event.data.user || this.resolveUser(event.data);
                    resolve({
                        success: true,
                        accessToken: event.data.access_token,
                        user: rawUser ? this.normalizeUser(rawUser) : undefined
                    });
                } else if (event.data.type === 'oauth_error') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    resolve({ success: false, message: event.data.message || 'OAuth login failed' });
                }
            };

            window.addEventListener('message', messageHandler);

            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    resolve({ success: false, message: 'Login cancelled' });
                }
            }, 500);
        });
    }

    // ── Multi-tenant ─────────────────────────────────────────────────────────

    async selectTenant(tenantId: string, accessToken: string): Promise<AuthResult> {
        try {
            const accountsUrl = this.getAccountsUrl();
            const response = await fetch(`${accountsUrl}/api/auth/select-tenant`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ tenant_id: tenantId })
            });
            const data = await response.json();
            if (this.isAuthSuccess(data)) {
                return { success: true, accessToken: this.resolveAccessToken(data) };
            }
            return { success: false, message: this.resolveErrorMessage(data, 'Failed to select tenant') };
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async getTenantMemberships(accessToken: string): Promise<TenantMembership[]> {
        try {
            const accountsUrl = this.getAccountsUrl();
            const response = await fetch(`${accountsUrl}/api/auth/memberships`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            const data = await response.json();
            return data.memberships || [];
        } catch {
            return [];
        }
    }

    async registerTenant(data: RegisterTenantData): Promise<AuthResult> {
        if (data.provider !== 'emailPassword') {
            return this.registerTenantWithOAuth(data.tenantName, data.provider);
        }
        try {
            const apiUrl = this.getPlatformApiUrl();
            const body: Record<string, string> = {
                tenant_name: data.tenantName,
                email: data.email ?? '',
                password: data.password ?? '',
                provider: 'emailPassword'
            };
            if (data.displayName) body['display_name'] = data.displayName;
            if (data.countryCode) body['country_code'] = data.countryCode;
            if (data.role) body['role'] = data.role;
            const response = await fetch(`${apiUrl}/auth/register-tenant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (result?.status === 'ok' || result?.success === true) {
                return { success: true };
            }
            return { success: false, message: result?.data?.message || result?.message || 'Registration failed' };
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    private async registerTenantWithOAuth(
        tenantName: string,
        provider: string
    ): Promise<AuthResult> {
        return new Promise((resolve) => {
            const width = 500, height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const accountsUrl = this.getAccountsUrl();
            const oauthUrl = `${accountsUrl}/oauth/${provider}?` +
                `platform=${this.config.platformCode}&mode=popup&action=register_tenant&` +
                `tenant_name=${encodeURIComponent(tenantName)}`;

            const popup = window.open(oauthUrl, `${provider}_register_tenant`,
                `width=${width},height=${height},left=${left},top=${top}`);

            if (!popup) {
                resolve({ success: false, message: 'Popup blocked. Please allow popups for this site.' });
                return;
            }

            const messageHandler = (event: MessageEvent) => {
                if (event.origin !== new URL(accountsUrl).origin) return;

                if (event.data.type === 'tenant_register_success') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    resolve({
                        success: true,
                        accessToken: event.data.access_token,
                        user: event.data.user ? this.normalizeUser(event.data.user) : undefined
                    });
                } else if (event.data.type === 'tenant_register_error') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    resolve({ success: false, message: event.data.message || 'Tenant registration failed' });
                }
            };

            window.addEventListener('message', messageHandler);

            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    resolve({ success: false, message: 'Registration cancelled' });
                }
            }, 500);
        });
    }

    async checkTenantSlugAvailable(slug: string): Promise<{ available: boolean; suggestion?: string }> {
        try {
            const accountsUrl = this.getAccountsUrl();
            const response = await fetch(`${accountsUrl}/api/auth/check-tenant-slug/${slug}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            return { available: data.available || false, suggestion: data.suggestion };
        } catch {
            return { available: true };
        }
    }

    async checkOnboardingStatus(identityId: string, platformCode?: string): Promise<any> {
        const accountsUrl = this.getAccountsUrl();
        const platform = platformCode ?? this.config.platformCode ?? '';
        const response = await fetch(
            `${accountsUrl}/api/auth/onboarding/status?platform_code=${platform}&identity_id=${identityId}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
        );
        if (!response.ok) throw new Error('Failed to check onboarding status');
        return response.json();
    }

    async completeTenantOnboarding(countryCode: string, tenantName: string, accessToken: string): Promise<any> {
        const apiUrl = this.getPlatformApiUrl();
        const response = await fetch(`${apiUrl}/auth/register-tenant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include',
            body: JSON.stringify({
                platform: this.config.platformCode,
                tenant_name: tenantName,
                country_code: countryCode,
                provider: 'google',
                oauth_token: accessToken
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create tenant');
        }
        return response.json();
    }

    async checkEmail(email: string): Promise<{ exists: boolean; user?: any }> {
        try {
            const accountsUrl = this.getAccountsUrl();
            const response = await fetch(`${accountsUrl}/api/auth/check-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            return { exists: data.exists, user: data.user };
        } catch {
            return { exists: false };
        }
    }
}
