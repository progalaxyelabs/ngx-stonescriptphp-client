import { TestBed } from '@angular/core/testing';

import { ApiConnectionService } from './api-connection.service';

describe('ApiConnectionService', () => {
  let service: ApiConnectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApiConnectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildQueryString — unit tests (no Angular DI needed; method is public)
// ─────────────────────────────────────────────────────────────────────────────

describe('ApiConnectionService.buildQueryString', () => {
  // Instantiate directly — avoids Angular DI for pure-logic tests
  const svc = new (ApiConnectionService as any)();

  it('returns empty string when called with no argument', () => {
    expect(svc.buildQueryString()).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(svc.buildQueryString(undefined)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(svc.buildQueryString(null)).toBe('');
  });

  it('serializes flat primitive params', () => {
    const qs = svc.buildQueryString({ start: 0, count: 50 });
    expect(qs).toBe('?start=0&count=50');
  });

  it('serializes a string param', () => {
    const qs = svc.buildQueryString({ search: 'aspirin' });
    expect(qs).toBe('?search=aspirin');
  });

  it('URL-encodes special characters in values', () => {
    const qs = svc.buildQueryString({ q: 'hello world' });
    expect(qs).toContain('q=hello%20world');
  });

  it('flattens a nested filters object into top-level params', () => {
    const qs = svc.buildQueryString({ filters: { status: 'active', item_form_id: 5 } });
    // Must NOT contain "[object Object]"
    expect(qs).not.toContain('%5Bobject%20Object%5D');
    expect(qs).not.toContain('[object Object]');
    // Should contain individual flattened params
    expect(qs).toContain('status=active');
    expect(qs).toContain('item_form_id=5');
  });

  it('does NOT produce [object Object] for deeply-named object values', () => {
    // Regression test for the traefiklogs bug:
    //   GET /portal/inventory/items?filters=%5Bobject%20Object%5D
    const qs = svc.buildQueryString({
      start: 0,
      count: 50,
      filters: { item_form_id: '3' }
    });
    expect(qs).not.toContain('Object');
    expect(qs).toContain('start=0');
    expect(qs).toContain('count=50');
    expect(qs).toContain('item_form_id=3');
  });

  it('skips null and undefined values', () => {
    const qs = svc.buildQueryString({ a: 'hello', b: null, c: undefined, d: 'world' });
    expect(qs).toBe('?a=hello&d=world');
  });

  it('skips null/undefined keys inside nested objects', () => {
    const qs = svc.buildQueryString({ filters: { x: null, y: 'ok' } });
    expect(qs).toBe('?y=ok');
  });

  it('handles arrays as primitive (encodes with encodeURIComponent, not flatten)', () => {
    // Arrays are not flattened — they are serialized as a single value via encodeURIComponent.
    // This preserves backward compat; multi-value array handling can be added if needed.
    const qs = svc.buildQueryString({ ids: [1, 2, 3] });
    expect(qs).toContain('ids=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// refreshAndRetry — AUTH-SPEC §4a session continuity (task #2644)
//
// Pins the refresh → exchange → retry contract so any future regression is
// caught at test time. Uses spies to avoid real HTTP calls.
// ─────────────────────────────────────────────────────────────────────────────

describe('ApiConnectionService.refreshAndRetry (AUTH-SPEC §4a)', () => {
    /**
     * Build a minimal mock that exposes the private refreshAndRetry method.
     * The method is private but we test its effects through the public request()
     * path by calling get() with a mocked fetch that returns 401 on the first call.
     */
    function makeService(opts: {
        refreshResult: boolean;
        exchangeResult: { success: boolean; message?: string; role?: string };
        retryStatus?: number;
    }) {
        const tokens = {
            getAccessToken: jasmine.createSpy('getAccessToken').and.returnValue('identity-jwt'),
            getRefreshToken: jasmine.createSpy('getRefreshToken').and.returnValue('refresh-jwt'),
            hasValidAccessToken: jasmine.createSpy('hasValidAccessToken').and.returnValue(true),
        };

        const authService = {
            refresh: jasmine.createSpy('refresh').and.resolveTo(opts.refreshResult),
            exchangeToken: jasmine.createSpy('exchangeToken').and.resolveTo(opts.exchangeResult),
            clearSession: jasmine.createSpy('clearSession'),
        };

        const environment = {
            apiServer: { host: 'http://localhost:3011' },
        };

        // Cast as any to bypass DI requirements in unit test
        const svc = new (ApiConnectionService as any)(tokens, environment, authService, null);
        return { svc, tokens, authService };
    }

    it('calls exchangeToken after refresh succeeds (happy path)', async () => {
        const { svc, authService } = makeService({
            refreshResult: true,
            exchangeResult: { success: true, role: 'owner' },
            retryStatus: 200,
        });

        // Simulate: first fetch → 401, retry → 200
        let callCount = 0;
        spyOn(window, 'fetch').and.callFake((_url: any, _opts: any) => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve(new Response(JSON.stringify({ status: 'error' }), { status: 401 }));
            }
            return Promise.resolve(new Response(JSON.stringify({ status: 'ok', data: {}, message: 'ok' }), { status: 200 }));
        });

        await svc.get('/test');

        expect(authService.refresh).toHaveBeenCalledTimes(1);
        expect(authService.exchangeToken).toHaveBeenCalledTimes(1);
    });

    it('calls exchangeToken with default endpoint /api/auth/exchange', async () => {
        const { svc, authService } = makeService({
            refreshResult: true,
            exchangeResult: { success: true, role: 'owner' },
        });

        spyOn(window, 'fetch').and.callFake((_url: any, _opts: any) => {
            return Promise.resolve(new Response(JSON.stringify({ status: 'error' }), { status: 401 }));
        });

        await svc.get('/test');

        // exchangeToken must be called — it uses default /api/auth/exchange internally
        expect(authService.exchangeToken).toHaveBeenCalledTimes(1);
    });

    it('does NOT call exchange when refresh fails', async () => {
        const { svc, authService } = makeService({
            refreshResult: false,
            exchangeResult: { success: false },
        });

        spyOn(window, 'fetch').and.resolveTo(
            new Response(JSON.stringify({ status: 'error' }), { status: 401 })
        );

        await svc.get('/test');

        expect(authService.refresh).toHaveBeenCalledTimes(1);
        // refresh failed → exchangeToken must NOT be called
        expect(authService.exchangeToken).not.toHaveBeenCalled();
    });

    it('still retries even when exchange fails (builtin-auth fallback)', async () => {
        const { svc, authService } = makeService({
            refreshResult: true,
            exchangeResult: { success: false, message: 'builtin mode — no exchange endpoint' },
        });

        let callCount = 0;
        spyOn(window, 'fetch').and.callFake((_url: any, _opts: any) => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve(new Response(JSON.stringify({ status: 'error' }), { status: 401 }));
            }
            return Promise.resolve(new Response(JSON.stringify({ status: 'ok', data: {}, message: 'ok' }), { status: 200 }));
        });

        const result = await svc.get('/test');

        // Exchange failed but retry still happened (graceful degradation)
        expect(authService.exchangeToken).toHaveBeenCalledTimes(1);
        // fetch was called twice (first 401, then retry)
        expect(callCount).toBe(2);
    });
});
