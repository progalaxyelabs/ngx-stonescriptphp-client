/**
 * Unit tests for the route-guard decision logic (SPEC §7.1).
 *
 * These exercise the framework-free core in `src/guard-logic.ts` — the same
 * functions the Angular CanActivateFn adapters delegate to — so the full §7.1
 * decision matrix (incl. the #2811 platform-token no-re-exchange seam) is pinned
 * without needing an Angular test harness.
 *
 * Run: npx tsc -p tests/tsconfig.test.json && node tests/out/guard-logic.test.js
 */
import assert from 'node:assert';
import {
    evaluateAuthGuard,
    evaluateLoginGuard,
    evaluateSubscriptionGuard,
    isPlatformToken,
    hasTenant
} from '../src/guard-logic';
import { NgxGuardRoutes } from '../src/guard-config';

const routes: NgxGuardRoutes = {
    login: '/login',
    dashboard: '/dashboard',
    onboarding: '/onboarding',
    subscriptionError: '/subscription-error'
};

const platformWithTenant = { token_type: 'platform', tenant_id: 't-123' };
const platformNoTenant = { token_type: 'platform', tenant_id: 'none' };
const identityToken = { token_type: 'identity', tenant_id: 't-123' };

let passed = 0;
let failed = 0;
const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

// ── predicates ────────────────────────────────────────────────────────────────
test('isPlatformToken: true only for token_type === platform', () => {
    assert.strictEqual(isPlatformToken({ token_type: 'platform' }), true);
    assert.strictEqual(isPlatformToken({ token_type: 'identity' }), false);
    assert.strictEqual(isPlatformToken({ local_user_id: 5 }), false); // legacy surrogate must NOT count
    assert.strictEqual(isPlatformToken(null), false);
});

test('hasTenant: true only for a real tenant_id (not absent/none)', () => {
    assert.strictEqual(hasTenant({ tenant_id: 't-1' }), true);
    assert.strictEqual(hasTenant({ tenant_id: 'none' }), false);
    assert.strictEqual(hasTenant({}), false);
    assert.strictEqual(hasTenant(null), false);
});

// ── authGuard matrix ────────────────────────────────────────────────────────
test('authGuard: unauthenticated → redirect login, no exchange', async () => {
    let exchanged = 0;
    const d = await evaluateAuthGuard({
        isAuthenticated: false, url: '/workspaces', routes,
        getPayload: () => null,
        exchange: async () => { exchanged++; return { success: true }; }
    });
    assert.deepStrictEqual(d, { allow: false, redirectTo: '/login' });
    assert.strictEqual(exchanged, 0);
});

test('authGuard: platform token + tenant → allow, NO re-exchange (#2811 seam)', async () => {
    let exchanged = 0;
    const d = await evaluateAuthGuard({
        isAuthenticated: true, url: '/workspaces', routes,
        getPayload: () => platformWithTenant,
        exchange: async () => { exchanged++; return { success: true }; }
    });
    assert.deepStrictEqual(d, { allow: true });
    assert.strictEqual(exchanged, 0, 'platform token must NOT be re-exchanged');
});

test('authGuard: identity token → exchange runs, then allow with tenant', async () => {
    let exchanged = 0;
    let payload: Record<string, any> = identityToken;
    const d = await evaluateAuthGuard({
        isAuthenticated: true, url: '/workspaces', routes,
        getPayload: () => payload,
        exchange: async () => { exchanged++; payload = platformWithTenant; return { success: true }; }
    });
    assert.deepStrictEqual(d, { allow: true });
    assert.strictEqual(exchanged, 1);
});

test('authGuard: identity token + exchange fails → redirect login', async () => {
    const d = await evaluateAuthGuard({
        isAuthenticated: true, url: '/workspaces', routes,
        getPayload: () => identityToken,
        exchange: async () => ({ success: false })
    });
    assert.deepStrictEqual(d, { allow: false, redirectTo: '/login' });
});

test('authGuard: platform token, no tenant, not onboarding → redirect onboarding', async () => {
    let exchanged = 0;
    const d = await evaluateAuthGuard({
        isAuthenticated: true, url: '/workspaces', routes,
        getPayload: () => platformNoTenant,
        exchange: async () => { exchanged++; return { success: true }; }
    });
    assert.deepStrictEqual(d, { allow: false, redirectTo: '/onboarding' });
    assert.strictEqual(exchanged, 0);
});

test('authGuard: platform token, no tenant, ON onboarding path → allow', async () => {
    const d = await evaluateAuthGuard({
        isAuthenticated: true, url: '/onboarding/step-1', routes,
        getPayload: () => platformNoTenant,
        exchange: async () => ({ success: true })
    });
    assert.deepStrictEqual(d, { allow: true });
});

// ── loginGuard matrix ─────────────────────────────────────────────────────────
test('loginGuard: authenticated + tenant → redirect dashboard', () => {
    const d = evaluateLoginGuard({ isAuthenticated: true, routes, getPayload: () => platformWithTenant });
    assert.deepStrictEqual(d, { allow: false, redirectTo: '/dashboard' });
});

test('loginGuard: authenticated, no tenant → allow', () => {
    const d = evaluateLoginGuard({ isAuthenticated: true, routes, getPayload: () => platformNoTenant });
    assert.deepStrictEqual(d, { allow: true });
});

test('loginGuard: unauthenticated → allow', () => {
    const d = evaluateLoginGuard({ isAuthenticated: false, routes, getPayload: () => null });
    assert.deepStrictEqual(d, { allow: true });
});

// ── subscriptionGuard matrix ───────────────────────────────────────────────────
test('subscriptionGuard: onboarding path → allow (no check)', () => {
    const d = evaluateSubscriptionGuard({
        url: '/onboarding/x', routes,
        probe: { ok: false, httpStatus: 402, isNetworkError: false }
    });
    assert.deepStrictEqual(d, { allow: true });
});

test('subscriptionGuard: 2xx → allow', () => {
    const d = evaluateSubscriptionGuard({
        url: '/billing', routes, probe: { ok: true, httpStatus: 200, isNetworkError: false }
    });
    assert.deepStrictEqual(d, { allow: true });
});

test('subscriptionGuard: 4xx → redirect subscriptionError', () => {
    const d = evaluateSubscriptionGuard({
        url: '/billing', routes, probe: { ok: false, httpStatus: 402, isNetworkError: false }
    });
    assert.deepStrictEqual(d, { allow: false, redirectTo: '/subscription-error' });
});

test('subscriptionGuard: 5xx → allow (fail-open)', () => {
    const d = evaluateSubscriptionGuard({
        url: '/billing', routes, probe: { ok: false, httpStatus: 503, isNetworkError: false }
    });
    assert.deepStrictEqual(d, { allow: true });
});

test('subscriptionGuard: network error → allow (fail-open)', () => {
    const d = evaluateSubscriptionGuard({
        url: '/billing', routes, probe: { ok: false, httpStatus: null, isNetworkError: true }
    });
    assert.deepStrictEqual(d, { allow: true });
});

(async () => {
    for (const [name, fn] of tests) {
        try {
            await fn();
            passed++;
            console.log(`  ✓ ${name}`);
        } catch (err) {
            failed++;
            console.error(`  ✗ ${name}\n      ${(err as Error).message}`);
        }
    }
    console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
    process.exit(failed === 0 ? 0 : 1);
})();
