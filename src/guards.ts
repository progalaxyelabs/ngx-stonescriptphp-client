/**
 * Library-provided route guards (SPEC §7.1).
 *
 * `authGuard`, `loginGuard`, and `subscriptionGuard` are `CanActivateFn`s that
 * consuming apps apply to their route definitions. Redirect targets and the
 * exchange/subscription endpoints come from `NGX_GUARD_CONFIG` (SPEC §7.2),
 * configured via `provideNgxStoneScriptPhpClient`'s 3rd argument.
 *
 * Decision logic lives in `guard-logic.ts` (framework-free, unit-tested); these
 * adapters only wire Angular DI to it and translate decisions into `UrlTree`s.
 */
import { inject, InjectionToken } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { ApiConnectionService } from './api-connection.service';
import { NgxGuardConfig, DEFAULT_GUARD_CONFIG } from './guard-config';
import {
    evaluateAuthGuard,
    evaluateLoginGuard,
    evaluateSubscriptionGuard,
    GuardDecision,
    SubscriptionProbe
} from './guard-logic';

/**
 * DI token carrying the resolved guard configuration. `provideNgxStoneScriptPhpClient`
 * always provides it (merging the consuming app's 3rd-arg config over the defaults);
 * the root factory below is a safety net if the provider is somehow absent.
 */
export const NGX_GUARD_CONFIG = new InjectionToken<NgxGuardConfig>('NGX_GUARD_CONFIG', {
    providedIn: 'root',
    factory: () => DEFAULT_GUARD_CONFIG
});

/** Translate a pure GuardDecision into the Angular guard return type. */
function toResult(decision: GuardDecision, router: Router): boolean | UrlTree {
    if ('redirectTo' in decision) {
        return router.parseUrl(decision.redirectTo);
    }
    return true;
}

/**
 * authGuard — protects routes that require authentication (SPEC §7.1).
 * Folds in the AUTH-SPEC identity→platform exchange-before-API step: a stored
 * identity JWT is exchanged once before the route loads; an already-exchanged
 * platform token (`token_type === 'platform'`) is never re-exchanged.
 */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
    const router = inject(Router);
    const auth = inject(AuthService);
    const tokens = inject(TokenService);
    const cfg = inject(NGX_GUARD_CONFIG);

    const decision = await evaluateAuthGuard({
        isAuthenticated: auth.isAuthenticated(),
        url: state.url,
        routes: cfg.routes,
        getPayload: () => tokens.decodeJwtPayload(),
        exchange: () => auth.exchangeToken(cfg.exchangeEndpoint)
    });
    return toResult(decision, router);
};

/**
 * loginGuard — keeps authenticated-with-tenant users off the login page (SPEC §7.1).
 */
export const loginGuard: CanActivateFn = (): boolean | UrlTree => {
    const router = inject(Router);
    const auth = inject(AuthService);
    const tokens = inject(TokenService);
    const cfg = inject(NGX_GUARD_CONFIG);

    const decision = evaluateLoginGuard({
        isAuthenticated: auth.isAuthenticated(),
        routes: cfg.routes,
        getPayload: () => tokens.decodeJwtPayload()
    });
    return toResult(decision, router);
};

/**
 * subscriptionGuard — gates routes requiring an active subscription (SPEC §7.1).
 * Fails open on 5xx/network errors so a subscription-service blip never locks users out.
 */
export const subscriptionGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
    const router = inject(Router);
    const api = inject(ApiConnectionService);
    const cfg = inject(NGX_GUARD_CONFIG);

    let probe: SubscriptionProbe;
    const res = await api.get(cfg.subscriptionStatusEndpoint);
    if (res.status === 'ok') {
        probe = { ok: true, httpStatus: 200, isNetworkError: false };
    } else {
        const meta: any = res.data ?? {};
        probe = {
            ok: false,
            httpStatus: typeof meta.httpStatus === 'number' ? meta.httpStatus : null,
            isNetworkError: !!meta.isNetworkError
        };
    }

    const decision = evaluateSubscriptionGuard({ url: state.url, routes: cfg.routes, probe });
    return toResult(decision, router);
};
