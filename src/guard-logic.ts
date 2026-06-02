/**
 * Framework-free decision logic for the route guards (SPEC §7.1).
 *
 * The exported Angular `CanActivateFn`s in `guards.ts` are thin adapters that
 * inject the real services and delegate here. Keeping the decisions pure makes
 * the full §7.1 decision matrix unit-testable without an Angular test harness.
 */
import { NgxGuardRoutes } from './guard-config';

/** A guard decision: allow navigation, or redirect to a path. */
export type GuardDecision = { allow: true } | { allow: false; redirectTo: string };

const ALLOW: GuardDecision = { allow: true };
const deny = (redirectTo: string): GuardDecision => ({ allow: false, redirectTo });

/**
 * A token is a "platform" token once it has been exchanged with the platform API
 * (AUTH-SPEC external mode). Detected by the canonical `token_type === 'platform'`
 * marker — NOT by any legacy integer surrogate (e.g. `local_user_id`, removed in
 * the identity_id re-key). A platform token must NEVER be re-exchanged.
 */
export function isPlatformToken(payload: Record<string, any> | null): boolean {
    return payload?.['token_type'] === 'platform';
}

/** A user "has a tenant" when the JWT `tenant_id` claim is present and not the sentinel 'none'. */
export function hasTenant(payload: Record<string, any> | null): boolean {
    const tenantId = payload?.['tenant_id'];
    return !!tenantId && tenantId !== 'none';
}

/** True when the URL is under the onboarding path prefix. */
export function isOnboardingPath(url: string, routes: NgxGuardRoutes): boolean {
    return url.startsWith(routes.onboarding);
}

/**
 * authGuard decision (SPEC §7.1 + AUTH-SPEC exchange-before-API):
 *  1. not authenticated            → redirect login
 *  2. token is not yet a platform  → exchange identity→platform; on failure → login
 *     token                          (a platform token is NOT re-exchanged — #2811 seam)
 *  3. no tenant & not onboarding   → redirect onboarding
 *  4. otherwise                    → allow
 */
export async function evaluateAuthGuard(ctx: {
    isAuthenticated: boolean;
    url: string;
    routes: NgxGuardRoutes;
    getPayload: () => Record<string, any> | null;
    exchange: () => Promise<{ success: boolean }>;
}): Promise<GuardDecision> {
    if (!ctx.isAuthenticated) {
        return deny(ctx.routes.login);
    }

    let payload = ctx.getPayload();
    if (!isPlatformToken(payload)) {
        const result = await ctx.exchange();
        if (!result.success) {
            return deny(ctx.routes.login);
        }
        payload = ctx.getPayload();
    }

    if (!hasTenant(payload) && !isOnboardingPath(ctx.url, ctx.routes)) {
        return deny(ctx.routes.onboarding);
    }

    return ALLOW;
}

/**
 * loginGuard decision (SPEC §7.1):
 *  - authenticated WITH tenant → redirect dashboard
 *  - otherwise (no tenant, or unauthenticated) → allow
 */
export function evaluateLoginGuard(ctx: {
    isAuthenticated: boolean;
    routes: NgxGuardRoutes;
    getPayload: () => Record<string, any> | null;
}): GuardDecision {
    if (ctx.isAuthenticated && hasTenant(ctx.getPayload())) {
        return deny(ctx.routes.dashboard);
    }
    return ALLOW;
}

/** Outcome of the subscription status probe, normalised from the ApiResponse. */
export interface SubscriptionProbe {
    /** true when the status endpoint returned a 2xx { status: 'ok' } response. */
    ok: boolean;
    /** HTTP status code on error, or null for network/transport errors. */
    httpStatus: number | null;
    /** true when the failure was a network/transport error (no HTTP response). */
    isNetworkError: boolean;
}

/**
 * subscriptionGuard decision (SPEC §7.1):
 *  - onboarding path     → allow (no subscription check)
 *  - 2xx                 → allow
 *  - 4xx                 → redirect subscriptionError
 *  - 5xx / network error → allow (fail-open)
 */
export function evaluateSubscriptionGuard(ctx: {
    url: string;
    routes: NgxGuardRoutes;
    probe: SubscriptionProbe;
}): GuardDecision {
    if (isOnboardingPath(ctx.url, ctx.routes)) {
        return ALLOW;
    }
    if (ctx.probe.ok) {
        return ALLOW;
    }
    const { httpStatus, isNetworkError } = ctx.probe;
    if (!isNetworkError && httpStatus !== null && httpStatus >= 400 && httpStatus < 500) {
        return deny(ctx.routes.subscriptionError);
    }
    // 5xx or network/transport error → fail-open
    return ALLOW;
}
