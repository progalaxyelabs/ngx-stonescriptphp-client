/*
 * Public API Surface of ngx-stonescriptphp-client
 */

// ── Core setup ────────────────────────────────────────────────────────────────
export * from './provide';                  // provideNgxStoneScriptPhpClient()
export * from './auth.plugin';              // AuthPlugin, AUTH_PLUGIN, AuthResult, User, ...

// ── Built-in auth plugin ──────────────────────────────────────────────────────
export * from './plugins/stonescriptphp-auth.plugin'; // StoneScriptPHPAuth, StoneScriptPHPAuthConfig

// ── Services ──────────────────────────────────────────────────────────────────
export * from './api-connection.service';
export * from './auth.service';
export * from './db.service';
export * from './signin-status.service';
export * from './token.service';
export * from './csrf.service';
export * from './files.service';
export * from './provider-registry.service';

// ── Models ────────────────────────────────────────────────────────────────────
export * from './api-response.model';
export * from './my-environment.model';
export * from './files.model';

// ── UI Components - Embeddable (standalone components) ────────────────────────
export * from './lib/components/auth-page.component';
export * from './lib/components/login-dialog.component';
export * from './lib/components/register.component';
export * from './lib/components/tenant-login.component';
export * from './lib/components/tenant-register.component';

// ── UI Components - Dialog/Modal wrappers ─────────────────────────────────────
export * from './lib/components/tenant-login-dialog.component';
export * from './lib/components/tenant-register-dialog.component';

// ── Re-export types for convenience ──────────────────────────────────────────
export type { OAuthProviderConfig } from './my-environment.model';
export { VerifyStatus } from './signin-status.service';

// ── Multi-tenant types ────────────────────────────────────────────────────────
export type { TenantSelectedEvent } from './lib/components/tenant-login.component';
export type { TenantCreatedEvent } from './lib/components/tenant-register.component';
