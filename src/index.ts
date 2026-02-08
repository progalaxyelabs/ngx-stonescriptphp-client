/*
 * Public API Surface of ngx-stonescriptphp-client
 */

export * from './api-connection.service';
export * from './auth.service';
export * from './db.service';
export * from './signin-status.service';
export * from './token.service';
export * from './csrf.service';
export * from './api-response.model';
export * from './my-environment.model';
export * from './files.service';
export * from './files.model';
export * from './ngx-stonescriptphp-client.module';

// UI Components - Embeddable (standalone components)
export * from './lib/components/auth-page.component';
export * from './lib/components/login-dialog.component';
export * from './lib/components/register.component';
export * from './lib/components/tenant-login.component';
export * from './lib/components/tenant-register.component';

// UI Components - Dialog/Modal wrappers
export * from './lib/components/tenant-login-dialog.component';
export * from './lib/components/tenant-register-dialog.component';

// Re-export types for convenience
export type { AuthProvider, User, AuthResult } from './auth.service';
export { VerifyStatus } from './signin-status.service';

// Multi-tenant types
export type { TenantMembership, TenantSelectedEvent } from './lib/components/tenant-login.component';
export type { TenantCreatedEvent } from './lib/components/tenant-register.component';
