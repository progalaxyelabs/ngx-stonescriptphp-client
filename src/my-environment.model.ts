export type AuthMode = 'cookie' | 'body' | 'none';

export interface AuthConfig {
    /**
     * Authentication mode:
     * - 'cookie': Use httpOnly cookies + CSRF tokens (recommended, matches StoneScriptPHP v2.1.x)
     * - 'body': Send tokens in request body (legacy mode)
     * - 'none': No automatic token refresh
     */
    mode: AuthMode;

    /**
     * Auth server host for token refresh and all auth operations.
     * Use this when auth is on a different server than the API.
     * Replaces the deprecated accountsUrl and accountsServer fields.
     * @example 'https://accounts.progalaxyelabs.com'
     */
    host?: string;

    /**
     * Token refresh endpoint path.
     * @default '/auth/refresh' for cookie mode, '/user/refresh_access' for body mode
     */
    refreshEndpoint?: string;

    /**
     * Enable CSRF token support (required for cookie mode).
     * @default true for cookie mode, false for body mode
     */
    useCsrf?: boolean;

    /**
     * Cookie name for refresh token.
     * @default 'refresh_token'
     */
    refreshTokenCookieName?: string;

    /**
     * Cookie name for CSRF token.
     * @default 'csrf_token'
     */
    csrfTokenCookieName?: string;

    /**
     * CSRF header name.
     * @default 'X-CSRF-Token'
     */
    csrfHeaderName?: string;

    /**
     * Response field mapping for external auth compatibility.
     * Defaults to StoneScriptPHP format: { status:'ok', data:{ access_token, user } }
     * Replaces the deprecated top-level authResponseMap field.
     */
    responseMap?: Partial<AuthResponseMap>;
}

/**
 * Authentication server configuration (for multi-server mode via StoneScriptPHPAuth).
 */
export interface AuthServerConfig {
    /** Server URL (e.g., 'https://accounts.progalaxyelabs.com') */
    url: string;
    /** JWKS endpoint for token validation (optional, defaults to /api/auth/jwks) */
    jwksEndpoint?: string;
    /** Whether this is the default server */
    default?: boolean;
}

/**
 * Configuration for a custom OAuth provider.
 */
export interface OAuthProviderConfig {
    /** Display label for the provider (e.g., "Okta") */
    label: string;
    /** Optional icon character or emoji to display */
    icon?: string;
    /** Optional CSS class to apply to the button (e.g., "btn-okta") */
    cssClass?: string;
    /** Optional inline button styles for custom branding */
    buttonStyle?: {
        borderColor?: string;
        backgroundColor?: string;
        color?: string;
    };
}

/**
 * Maps auth service response fields to expected locations.
 * Paths use dot-notation (e.g., 'data.access_token' for nested fields).
 *
 * StoneScriptPHP format:  { status: 'ok', data: { access_token, user, ... } }
 * Raw/external format:    { access_token, identity, ... }
 */
export interface AuthResponseMap {
    /**
     * Dot-path to check for success (e.g., 'status' for StoneScriptPHP).
     * If omitted, success is determined by presence of accessToken.
     */
    successPath?: string;

    /** Value that indicates success at successPath (e.g., 'ok') */
    successValue?: string;

    /** Dot-path to the access token (default: 'data.access_token') */
    accessTokenPath: string;

    /** Dot-path to the refresh token (default: 'data.refresh_token') */
    refreshTokenPath: string;

    /** Dot-path to the user/identity object (default: 'data.user') */
    userPath: string;

    /** Dot-path to error message (default: 'message') */
    errorMessagePath?: string;
}

export class MyEnvironmentModel {
    production: boolean = true

    /**
     * Platform code identifier (e.g., 'progalaxy', 'hr', 'admin').
     * Used for multi-tenant authentication.
     */
    platformCode: string = '';

    /**
     * Platform's own API base URL.
     * Used for routes that go through the platform API proxy (e.g. register-tenant).
     * Falls back to apiServer.host if not set.
     * @example '//api.medstoreapp.in'
     */
    apiUrl?: string;

    apiServer: {
        host: string
    } = { host: '' }

    /**
     * Files service server configuration.
     * Used by FilesService for file upload/download operations.
     * @example { host: 'https://files.progalaxyelabs.com/api/' }
     */
    filesServer?: {
        host: string
    }

    /**
     * Authentication configuration.
     * @default { mode: 'cookie', refreshEndpoint: '/auth/refresh', useCsrf: true }
     */
    auth?: AuthConfig = {
        mode: 'cookie',
        refreshEndpoint: '/auth/refresh',
        useCsrf: true,
        refreshTokenCookieName: 'refresh_token',
        csrfTokenCookieName: 'csrf_token',
        csrfHeaderName: 'X-CSRF-Token'
    };

    /**
     * Multiple authentication servers configuration (for StoneScriptPHPAuth multi-server mode).
     * @example
     * ```typescript
     * authServers: {
     *   customer: { url: 'https://auth.progalaxyelabs.com', default: true },
     *   employee: { url: 'https://admin-auth.progalaxyelabs.com' }
     * }
     * ```
     */
    authServers?: Record<string, AuthServerConfig>;

    /**
     * Custom OAuth provider configurations.
     * @example
     * ```typescript
     * customProviders: {
     *   okta: { label: 'Sign in with Okta', cssClass: 'btn-okta', buttonStyle: { borderColor: '#007dc1' } }
     * }
     * ```
     */
    customProviders?: Record<string, OAuthProviderConfig>;

    /**
     * Branding configuration for auth UI components.
     */
    branding?: {
        appName: string;
        logo?: string;
        primaryColor?: string;
        gradientStart?: string;
        gradientEnd?: string;
        subtitle?: string;
    };

    // ── Deprecated fields (kept for backward compatibility) ──────────────────

    /**
     * @deprecated Use auth.host instead.
     * Auth server URL for centralized authentication.
     */
    accountsUrl: string = '';

    /**
     * @deprecated Use auth.host instead.
     * Accounts/Authentication service server configuration.
     */
    accountsServer?: {
        host: string
    }

    /**
     * @deprecated Use auth.responseMap instead.
     * Auth response field mapping for external auth compatibility.
     */
    authResponseMap?: AuthResponseMap;
}
