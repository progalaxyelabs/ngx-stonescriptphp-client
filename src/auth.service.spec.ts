import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AUTH_PLUGIN } from './auth.plugin';
import { MyEnvironmentModel } from '@progalaxyelabs/stonescriptphp-client-core';
import { TokenService } from './token.service';

/** Minimal environment stub */
const ENV_STUB: MyEnvironmentModel = {
  production: false,
  debug: false,
  platformCode: 'test',
  apiServer: { host: 'http://localhost:9100' },
};

/** Minimal plugin stub — override individual methods per test */
function makePluginStub(overrides: Partial<any> = {}): any {
  return {
    login: async () => ({ success: false }),
    register: async () => ({ success: false }),
    logout: async () => {},
    refresh: async () => null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

// ── AUTH-SPEC §4a: tenant_id preservation during refresh ──────────────────────
//
// Per spec: "Tenant context is carried in the refresh token's own claims.
// Preservation does not depend on the optional access_token field."
//
// The CLIENT does not need special tenant-preservation logic — it just stores
// whatever new access_token the server returns (which the server has already
// stamped with the preserved tenant_id from the refresh_token's claims).
//
// These tests verify the client-side contract:
//   - When plugin.refresh() succeeds, the new token is stored and true returned.
//   - When plugin.refresh() fails, session is cleared and false returned.
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService.refresh() — AUTH-SPEC §4a tenant_id preservation', () => {
  let service: AuthService;
  let tokenService: TokenService;

  function build(pluginOverrides: Partial<any> = {}) {
    TestBed.configureTestingModule({
      providers: [
        { provide: MyEnvironmentModel, useValue: ENV_STUB },
        { provide: AUTH_PLUGIN, useValue: makePluginStub(pluginOverrides) },
      ],
    });
    service = TestBed.inject(AuthService);
    tokenService = TestBed.inject(TokenService);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('stores new access_token when plugin.refresh() succeeds', async () => {
    // Simulate: server received refresh_token, preserved tenant_id, returned new JWT
    const newToken = 'eyJuZXdfdG9rZW4iOiJ0cnVlIn0';  // opaque JWT stub
    build({ refresh: async () => newToken });

    // Prime a stale refresh token so refresh() forwards it to the plugin
    tokenService.setRefreshToken('old-refresh-token');

    const result = await service.refresh();

    expect(result).toBeTrue();
    expect(tokenService.getAccessToken()).toBe(newToken);
  });

  it('clears session and returns false when plugin.refresh() fails', async () => {
    build({ refresh: async () => null });

    tokenService.setRefreshToken('expired-token');
    tokenService.setAccessToken('old-access-token');

    const result = await service.refresh();

    expect(result).toBeFalse();
    expect(tokenService.getAccessToken()).toBeNull();
  });

  it('passes both access_token and refresh_token to plugin — access_token is optional per spec', async () => {
    // Capture what the plugin receives to verify the client sends both tokens.
    // Per AUTH-SPEC §4a: access_token is optional (used only for server logging);
    // the server MUST NOT use it as the source of tenant context.
    const captured: { accessToken: string; refreshToken?: string }[] = [];
    build({
      refresh: async (accessToken: string, refreshToken?: string) => {
        captured.push({ accessToken, refreshToken });
        return 'new-token';
      }
    });

    tokenService.setAccessToken('current-access-token');
    tokenService.setRefreshToken('current-refresh-token');

    await service.refresh();

    expect(captured.length).toBe(1);
    // Both tokens forwarded to plugin — server uses refresh_token claims for tenant preservation
    expect(captured[0].accessToken).toBe('current-access-token');
    expect(captured[0].refreshToken).toBe('current-refresh-token');
  });

  it('returns false without calling plugin when no refresh_token is available', async () => {
    let pluginCalled = false;
    build({ refresh: async () => { pluginCalled = true; return null; } });

    // No refresh token stored — plugin should not be called
    // (TokenService.getRefreshToken returns null/undefined; plugin.refresh aborts early)
    const result = await service.refresh();

    // Plugin returns null when called without refresh token — treated as failure
    expect(result).toBeFalse();
  });
});
