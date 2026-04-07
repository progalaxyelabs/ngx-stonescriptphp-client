import { AuthPlugin, AuthResult, OtpSendResponse, OtpVerifyResponse, TenantMembership, User } from '../auth.plugin';

export interface ProgalaxyElabsAuthConfig {
    host: string;
    platformCode: string;
}

/**
 * Auth plugin for progalaxyelabs-auth (Rust/Axum).
 *
 * Speaks the Rust auth server's native format:
 *   - Login: { access_token, refresh_token, identity, membership, ... }
 *   - Tenant selection: { requires_tenant_selection, selection_token, memberships }
 *   - New identity: { access_token, identity, is_new_identity, memberships:[] }
 *   - select-tenant: Bearer header + { tenant_id } body
 *   - refresh: { access_token, refresh_token } body mode
 */
export class ProgalaxyElabsAuth implements AuthPlugin {

    constructor(private config: ProgalaxyElabsAuthConfig) {}

    private get host(): string {
        return this.config.host;
    }

    // -- Login ----------------------------------------------------------------

    async login(email: string, password: string): Promise<AuthResult> {
        try {
            const response = await fetch(`${this.host}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, platform_code: this.config.platformCode })
            });
            const data = await response.json();
            if (!response.ok) {
                return { success: false, message: data.error || data.message || 'Login failed' };
            }
            return this.handleLoginResponse(data);
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async register(email: string, password: string, displayName: string): Promise<AuthResult> {
        try {
            const response = await fetch(`${this.host}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    display_name: displayName,
                    platform_code: this.config.platformCode
                })
            });
            const data = await response.json();
            if (!response.ok) {
                return { success: false, message: data.error || data.message || 'Registration failed' };
            }
            return this.handleLoginResponse(data);
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // -- Logout ---------------------------------------------------------------

    async logout(refreshToken?: string): Promise<void> {
        try {
            await fetch(`${this.host}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
        } catch { /* ignore */ }
    }

    // -- Session & Refresh ----------------------------------------------------

    async checkSession(): Promise<AuthResult> {
        return { success: false };
    }

    async refresh(accessToken: string, refreshToken?: string): Promise<string | null> {
        if (!refreshToken) return null;
        try {
            const response = await fetch(`${this.host}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
            });
            if (!response.ok) return null;
            const data = await response.json();

            // Refresh can also return tenant_selection if memberships changed
            if (data.requires_tenant_selection) return null;

            return data.access_token ?? null;
        } catch {
            return null;
        }
    }

    // -- Tenant operations ----------------------------------------------------

    async selectTenant(tenantId: string, selectionToken: string): Promise<AuthResult> {
        try {
            const response = await fetch(`${this.host}/api/auth/select-tenant`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${selectionToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tenant_id: tenantId })
            });
            const data = await response.json();
            if (!response.ok) {
                return { success: false, message: data.error || data.message || 'Tenant selection failed' };
            }
            return {
                success: true,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                user: this.toUser(data.identity, data.membership?.role),
                membership: this.toMembership(data.membership),
            };
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async getTenantMemberships(accessToken: string): Promise<TenantMembership[]> {
        try {
            const platformCode = encodeURIComponent(this.config.platformCode);
            const response = await fetch(`${this.host}/api/auth/memberships?platform_code=${platformCode}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return (data.memberships || []).map((m: any) => this.toMembership(m));
        } catch {
            return [];
        }
    }

    async checkTenantSlugAvailable(slug: string): Promise<{ available: boolean; suggestion?: string }> {
        try {
            const response = await fetch(`${this.host}/api/auth/check-tenant-slug/${slug}`);
            const data = await response.json();
            return { available: data.available || false, suggestion: data.suggestion };
        } catch {
            return { available: true };
        }
    }

    async checkOnboardingStatus(identityId: string, platformCode?: string): Promise<any> {
        const platform = platformCode ?? this.config.platformCode;
        const response = await fetch(
            `${this.host}/api/auth/onboarding/status?platform_code=${platform}&identity_id=${identityId}`
        );
        if (!response.ok) throw new Error('Failed to check onboarding status');
        return response.json();
    }

    async checkEmail(email: string): Promise<{ exists: boolean; user?: any }> {
        try {
            const response = await fetch(`${this.host}/api/auth/check-email`, {
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

    // -- OTP authentication --------------------------------------------------

    async sendOtp(identifier: string): Promise<OtpSendResponse> {
        try {
            const response = await fetch(`${this.host}/api/auth/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, platform_code: this.config.platformCode })
            });
            const data = await response.json();
            if (!response.ok) {
                return {
                    success: false,
                    identifier_type: 'email',
                    masked_identifier: '',
                    expires_in: 0,
                    resend_after: 0,
                    ...data
                };
            }
            return {
                success: data.success ?? true,
                identifier_type: data.identifier_type,
                masked_identifier: data.masked_identifier,
                expires_in: data.expires_in,
                resend_after: data.resend_after
            };
        } catch {
            return {
                success: false,
                identifier_type: 'email',
                masked_identifier: '',
                expires_in: 0,
                resend_after: 0
            };
        }
    }

    async verifyOtp(identifier: string, code: string): Promise<OtpVerifyResponse> {
        try {
            const response = await fetch(`${this.host}/api/auth/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, code })
            });
            const data = await response.json();
            if (!response.ok) {
                return { success: false, verified_token: '', ...data };
            }
            return {
                success: data.success ?? true,
                verified_token: data.verified_token
            };
        } catch {
            return { success: false, verified_token: '' };
        }
    }

    async identityLogin(verifiedToken: string): Promise<AuthResult> {
        try {
            const response = await fetch(`${this.host}/api/identity/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verified_token: verifiedToken,
                    platform_code: this.config.platformCode
                })
            });
            // 404 means no identity found — caller should show registration form
            if (response.status === 404) {
                return { success: false, message: 'identity_not_found' };
            }
            const data = await response.json();
            if (!response.ok) {
                return { success: false, message: data.error || data.message || 'Login failed' };
            }
            return this.handleLoginResponse(data);
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async identityRegister(verifiedToken: string, displayName: string): Promise<AuthResult> {
        try {
            const response = await fetch(`${this.host}/api/identity/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    verified_token: verifiedToken,
                    display_name: displayName,
                    platform_code: this.config.platformCode
                })
            });
            const data = await response.json();
            if (!response.ok) {
                return { success: false, message: data.error || data.message || 'Registration failed' };
            }
            return this.handleLoginResponse(data);
        } catch {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // -- OAuth ----------------------------------------------------------------

    async loginWithProvider(provider: string): Promise<AuthResult> {
        return new Promise((resolve) => {
            const width = 500, height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const oauthUrl = `${this.host}/oauth/${provider}?platform_code=${this.config.platformCode}&mode=popup`;
            const popup = window.open(oauthUrl, `${provider}_login`,
                `width=${width},height=${height},left=${left},top=${top}`);

            if (!popup) {
                resolve({ success: false, message: 'Popup blocked. Please allow popups for this site.' });
                return;
            }

            const cleanup = () => {
                window.removeEventListener('message', messageHandler);
                clearInterval(checkClosed);
                if (popup && !popup.closed) popup.close();
            };

            const messageHandler = (event: MessageEvent) => {
                if (event.origin !== new URL(this.host).origin) return;
                cleanup();

                if (event.data.type === 'oauth_success') {
                    resolve({
                        success: true,
                        accessToken: event.data.access_token,
                        refreshToken: event.data.refresh_token,
                        user: this.toUser(event.data.user || event.data.identity),
                        membership: event.data.membership ? this.toMembership(event.data.membership) : undefined,
                    });
                } else if (event.data.type === 'oauth_tenant_selection') {
                    resolve({
                        success: true,
                        accessToken: event.data.selection_token,
                        memberships: (event.data.memberships || []).map((m: any) => this.toMembership(m)),
                    });
                } else if (event.data.type === 'oauth_new_identity') {
                    resolve({
                        success: true,
                        accessToken: event.data.access_token,
                        refreshToken: event.data.refresh_token,
                        isNewIdentity: true,
                        authMethod: event.data.auth_method,
                        oauthProvider: event.data.oauth_provider,
                        identity: event.data.identity,
                    });
                } else if (event.data.type === 'oauth_error') {
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

    // -- Internal helpers -----------------------------------------------------

    private handleLoginResponse(data: any): AuthResult {
        // Identity with no tenant memberships — needs onboarding
        // Covers both new registration (is_new_identity=true) and
        // returning user who hasn't created a tenant yet (is_new_identity=false, memberships=[])
        if (data.identity && (!data.membership)) {
            return {
                success: true,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                user: this.toUser(data.identity),
                isNewIdentity: data.is_new_identity ?? false,
                authMethod: data.auth_method,
                oauthProvider: data.oauth_provider,
            };
        }

        // Multi-tenant selection required
        if (data.requires_tenant_selection) {
            return {
                success: true,
                accessToken: data.selection_token,
                memberships: (data.memberships || []).map((m: any) => this.toMembership(m)),
            };
        }

        // Standard success (single tenant auto-selected or tenant specified)
        return {
            success: true,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            user: this.toUser(data.identity, data.membership?.role),
            membership: this.toMembership(data.membership),
        };
    }

    private toUser(raw: any, role?: string): User | undefined {
        if (!raw) return undefined;
        const user: User = {
            email: raw.email ?? '',
            phone: raw.phone,
            display_name: raw.display_name ?? raw.email?.split('@')[0] ?? '',
            photo_url: raw.photo_url ?? raw.picture,
            is_email_verified: raw.is_email_verified ?? false
        };
        // Populate role: prefer explicit param, then raw.role, then raw.membership?.role
        const resolvedRole = role ?? raw.role ?? raw.membership?.role;
        if (resolvedRole) user.role = resolvedRole;
        return user;
    }

    private toMembership(raw: any): TenantMembership {
        return {
            tenant_id: raw.tenant_id,
            slug: raw.tenant_slug ?? raw.slug ?? '',
            name: raw.tenant_name ?? raw.name ?? '',
            role: raw.role ?? '',
            status: raw.status ?? 'active',
        };
    }
}
