import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

/**
 * HTTP Interceptor for authentication
 *
 * Features:
 * - Adds Authorization header with Bearer token
 * - Adds X-Tenant-ID header if tenant context is set
 * - Handles 401 responses with automatic token refresh and retry
 * - Handles 403 responses by emitting unauthorized event
 * - Skips interceptor for auth endpoints (/auth/*)
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Skip interceptor for auth endpoints to prevent infinite loops
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  // Clone request and add authentication headers
  const authReq = addAuthHeaders(req, tokenService);

  // Process the request and handle errors
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Handle 401: Try to refresh token and retry
        return handle401Error(authReq, next, authService, tokenService, router);
      } else if (error.status === 403) {
        // Handle 403: Emit unauthorized event
        handle403Error(router);
        return throwError(() => error);
      }

      // For other errors, just pass them through
      return throwError(() => error);
    })
  );
};

/**
 * Add authentication headers to the request
 */
function addAuthHeaders(req: HttpRequest<any>, tokenService: TokenService): HttpRequest<any> {
  const accessToken = tokenService.getAccessToken();
  const tenantId = tokenService.getCurrentTenantId();

  let headers = req.headers;

  // Add Authorization header if access token exists
  if (accessToken) {
    headers = headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Add X-Tenant-ID header if tenant context is set
  if (tenantId) {
    headers = headers.set('X-Tenant-ID', tenantId);
  }

  return req.clone({ headers });
}

/**
 * Handle 401 Unauthorized errors
 * Attempts to refresh the access token and retry the original request
 */
function handle401Error(
  req: HttpRequest<any>,
  next: any,
  authService: AuthService,
  tokenService: TokenService,
  router: Router
) {
  // Attempt to refresh the token
  return authService.refreshToken().pipe(
    switchMap(() => {
      // Token refresh succeeded, retry the original request with new token
      const retryReq = addAuthHeaders(req, tokenService);
      return next(retryReq);
    }),
    catchError((refreshError) => {
      // Token refresh failed - logout and redirect to login
      console.error('Token refresh failed, logging out:', refreshError);
      authService.logout();

      // Redirect to login page
      router.navigate(['/login']);

      // Return the original error
      return throwError(() => refreshError);
    })
  );
}

/**
 * Handle 403 Forbidden errors
 * Emits an unauthorized event (can be used for showing permission denied messages)
 */
function handle403Error(router: Router) {
  // Emit a custom event that components can listen to
  const event = new CustomEvent('ssp-unauthorized', {
    detail: { message: 'You do not have permission to access this resource' }
  });
  window.dispatchEvent(event);

  console.warn('403 Forbidden: User does not have permission to access the resource');
}
