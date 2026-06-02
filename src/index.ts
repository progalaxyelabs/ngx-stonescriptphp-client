/**
 * @progalaxyelabs/ngx-stonescriptphp-client v2.0.0
 *
 * Angular client library for StoneScriptPHP backend framework.
 *
 * Breaking changes from v1.x:
 * - SigninStatusService removed (use AuthService.user signal)
 * - DbService removed (was empty stub)
 * - VerifyStatus enum removed
 * - uploadDrawing/uploadImage removed from ApiConnectionService
 * - UI components moved to @progalaxyelabs/ngx-stonescriptphp-ui
 * - FilesService moved to @progalaxyelabs/ngx-stonescriptphp-files-client
 * - ProviderRegistryService moved to @progalaxyelabs/ngx-stonescriptphp-ui
 * - Core types now come from @progalaxyelabs/stonescriptphp-client-core
 * - Auth plugins now come from @progalaxyelabs/stonescriptphp-auth-client
 */

// ── Core setup ────────────────────────────────────────────────────────────────
export { provideNgxStoneScriptPhpClient } from './provide';
export { AUTH_PLUGIN } from './auth.plugin';

// ── Route guards (SPEC §7) ──────────────────────────────────────────────────
export { authGuard, loginGuard, subscriptionGuard, NGX_GUARD_CONFIG } from './guards';
export {
    NgxGuardConfig,
    NgxGuardConfigInput,
    NgxGuardRoutes,
    DEFAULT_GUARD_CONFIG
} from './guard-config';

// ── Services ──────────────────────────────────────────────────────────────────
export { ApiConnectionService } from './api-connection.service';
export { AuthService, BuiltInProvider, AuthProvider } from './auth.service';
export { TokenService } from './token.service';
export { CsrfService } from './csrf.service';
export { LogService } from './log.service';
export { AnalyticsService } from './analytics.service';

// ── Notification Handler ──────────────────────────────────────────────────────
export { NOTIFICATION_HANDLER, NotificationHandler } from './notification-handler';

// ── Models (re-exported from core) ────────────────────────────────────────────
export { ApiResponse } from './api-response.model';
export {
    MyEnvironmentModel,
    AuthConfig,
    AuthMode,
    AuthServerConfig,
    AuthResponseMap,
    OAuthProviderConfig
} from './my-environment.model';

// ── Auth types (re-exported from core) ────────────────────────────────────────
export type {
    AuthPlugin,
    AuthResult,
    User,
    TenantMembership,
    OtpSendResponse,
    OtpVerifyResponse
} from './auth.plugin';

// ── Auth plugins (re-exported from auth-client for convenience) ───────────────
export {
    StoneScriptPHPAuth,
    StoneScriptPHPAuthConfig,
    ProgalaxyElabsAuth,
    ProgalaxyElabsAuthConfig
} from '@progalaxyelabs/stonescriptphp-auth-client';
