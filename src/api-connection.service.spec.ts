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
