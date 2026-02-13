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
     * Token refresh endpoint path
     * @default '/auth/refresh' for cookie mode, '/user/refresh_access' for body mode
     */
    refreshEndpoint?: string;

    /**
     * Enable CSRF token support (required for cookie mode)
     * @default true for cookie mode, false for body mode
     */
    useCsrf?: boolean;

    /**
     * Cookie name for refresh token
     * @default 'refresh_token'
     */
    refreshTokenCookieName?: string;

    /**
     * Cookie name for CSRF token
     * @default 'csrf_token'
     */
    csrfTokenCookieName?: string;

    /**
     * CSRF header name
     * @default 'X-CSRF-Token'
     */
    csrfHeaderName?: string;
}

/**
 * Authentication server configuration
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
 * Used to register custom providers via the ProviderRegistryService
 * or through the environment's customProviders field.
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

export class MyEnvironmentModel {
    production: boolean = true

    /**
     * Platform code identifier (e.g., 'progalaxy', 'hr', 'admin')
     * Used for multi-tenant authentication
     */
    platformCode: string = '';

    /**
     * Accounts platform URL for centralized authentication (single-server mode)
     * @example 'https://accounts.progalaxyelabs.com'
     * @deprecated Use authServers for multi-server support
     */
    accountsUrl: string = '';

    /**
     * Multiple authentication servers configuration
     * Enables platforms to authenticate against different identity providers
     * @example
     * ```typescript
     * authServers: {
     *   customer: { url: 'https://auth.progalaxyelabs.com', default: true },
     *   employee: { url: 'https://admin-auth.progalaxyelabs.com' }
     * }
     * ```
     */
    authServers?: Record<string, AuthServerConfig>;

    firebase: {
        projectId: string
        appId: string
        databaseURL: string
        storageBucket: string
        locationId: string
        apiKey: string
        authDomain: string
        messagingSenderId: string
        measurementId: string
    } = {
            projectId: '',
            appId: '',
            databaseURL: '',
            storageBucket: '',
            locationId: '',
            apiKey: '',
            authDomain: '',
            messagingSenderId: '',
            measurementId: ''
        }
    apiServer: {
        host: string
    } = { host: '' }
    chatServer: {
        host: string
    } = { host: '' }

    /**
     * Authentication service server configuration
     * Use this when auth is on a different server than the API
     * Falls back to accountsUrl if not specified
     * @example { host: 'https://auth.progalaxyelabs.com' }
     */
    authServer?: {
        host: string
    }

    /**
     * Files service server configuration
     * Used by FilesService for file upload/download operations
     * @example { host: 'https://files.progalaxyelabs.com/api/' }
     */
    filesServer?: {
        host: string
    }

    /**
     * Authentication configuration
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
     * Custom OAuth provider configurations.
     * Register additional OAuth providers beyond the built-in ones
     * (google, linkedin, apple, microsoft, github, zoho).
     * @example
     * ```typescript
     * customProviders: {
     *   okta: { label: 'Sign in with Okta', cssClass: 'btn-okta', buttonStyle: { borderColor: '#007dc1' } },
     *   keycloak: { label: 'Sign in with Keycloak', icon: '🔑' }
     * }
     * ```
     */
    customProviders?: Record<string, OAuthProviderConfig>;

    /**
     * Branding configuration for auth components
     * Allows platforms to customize login/register pages without creating wrappers
     */
    branding?: {
        /** Application name displayed on auth pages */
        appName: string;
        /** URL to logo image */
        logo?: string;
        /** Primary brand color (hex) */
        primaryColor?: string;
        /** Gradient start color (hex) */
        gradientStart?: string;
        /** Gradient end color (hex) */
        gradientEnd?: string;
        /** Subtitle text displayed on auth pages */
        subtitle?: string;
    };
}