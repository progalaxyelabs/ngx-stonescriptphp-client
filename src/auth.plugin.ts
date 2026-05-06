/**
 * Angular injection token for auth plugins.
 *
 * The AuthPlugin interface and related types are now in @progalaxyelabs/stonescriptphp-client-core.
 * This file provides the Angular-specific injection token.
 */
import { InjectionToken } from '@angular/core';
import { AuthPlugin } from '@progalaxyelabs/stonescriptphp-client-core';

export const AUTH_PLUGIN = new InjectionToken<AuthPlugin>('AUTH_PLUGIN');

// Re-export types from core for convenience
export type {
    AuthPlugin,
    AuthResult,
    User,
    TenantMembership,
    OtpSendResponse,
    OtpVerifyResponse
} from '@progalaxyelabs/stonescriptphp-client-core';
