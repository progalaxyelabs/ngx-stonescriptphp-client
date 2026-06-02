/**
 * Configuration contract for the library-provided route guards (SPEC §7.2).
 *
 * Because consuming apps define their own route paths, the guards take their
 * redirect targets from this config rather than hard-coding them. Pure types +
 * defaults only — no Angular imports, so the guard decision logic that depends
 * on these stays framework-free and unit-testable.
 */

/** Redirect targets the guards navigate to (SPEC §7.2). */
export interface NgxGuardRoutes {
    /** Where authGuard sends unauthenticated users, and where exchange-failures land. */
    login: string;
    /** Where loginGuard sends already-authenticated-with-tenant users. */
    dashboard: string;
    /**
     * Onboarding path prefix. authGuard redirects tenant-less users here, and
     * both authGuard and subscriptionGuard treat URLs under this prefix as
     * "onboarding in progress" and skip their tenant / subscription checks.
     */
    onboarding: string;
    /** Where subscriptionGuard sends users whose subscription check returns 4xx. */
    subscriptionError: string;
}

/** Full guard configuration (SPEC §7.2). */
export interface NgxGuardConfig {
    routes: NgxGuardRoutes;
    /**
     * Endpoint authGuard calls to exchange an identity JWT for a platform JWT
     * (AUTH-SPEC external mode). Default: 'api/auth/exchange'.
     */
    exchangeEndpoint: string;
    /**
     * Endpoint subscriptionGuard probes for an active subscription (SPEC §7.1).
     * Default: 'subscription/status'.
     */
    subscriptionStatusEndpoint: string;
    /**
     * Tenant mode (SPEC §7.1).
     *   `true`  (default) — multi-tenant: authGuard bounces tenant-less users to
     *           onboarding; loginGuard lets tenant-less users stay on login to
     *           select a tenant.
     *   `false` — tenant-less single-plan B2C: no tenant gate, no onboarding
     *           bounce; an authenticated platform token always proceeds, and
     *           loginGuard sends any authenticated user to the dashboard.
     * @default true
     */
    requireTenant: boolean;
}

/**
 * Shape accepted by `provideNgxStoneScriptPhpClient`'s 3rd arg. Every field is
 * optional and `routes` may be partially overridden — missing values fall back
 * to {@link DEFAULT_GUARD_CONFIG}.
 */
export interface NgxGuardConfigInput {
    routes?: Partial<NgxGuardRoutes>;
    exchangeEndpoint?: string;
    subscriptionStatusEndpoint?: string;
    /** See {@link NgxGuardConfig.requireTenant}. @default true */
    requireTenant?: boolean;
}

/** Sensible defaults; consuming apps override via `provideNgxStoneScriptPhpClient`'s 3rd arg. */
export const DEFAULT_GUARD_CONFIG: NgxGuardConfig = {
    routes: {
        login: '/login',
        dashboard: '/dashboard',
        onboarding: '/onboarding',
        subscriptionError: '/subscription-error'
    },
    exchangeEndpoint: 'api/auth/exchange',
    subscriptionStatusEndpoint: 'subscription/status',
    requireTenant: true
};
