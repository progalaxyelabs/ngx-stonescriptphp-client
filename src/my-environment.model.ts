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

export class MyEnvironmentModel {
    production: boolean = true

    /**
     * Platform code identifier (e.g., 'progalaxy', 'hr', 'admin')
     * Used for multi-tenant authentication
     */
    platformCode: string = '';

    /**
     * Accounts platform URL for centralized authentication
     * @example 'https://accounts.progalaxyelabs.com'
     */
    accountsUrl: string = '';

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