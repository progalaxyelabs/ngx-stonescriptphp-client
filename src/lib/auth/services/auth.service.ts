import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { TokenService } from './token.service';
import { MyEnvironmentModel, AuthConfig } from '../../../my-environment.model';
import {
  AuthResponse,
  Identity,
  Membership,
  RefreshTokenResponse,
  OAuthState
} from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly authConfig: AuthConfig;
  private readonly apiHost: string;

  // BehaviorSubjects for reactive state
  private identitySubject = new BehaviorSubject<Identity | null>(null);
  private membershipSubject = new BehaviorSubject<Membership | null>(null);

  public identity$ = this.identitySubject.asObservable();
  public membership$ = this.membershipSubject.asObservable();

  private refreshTimerSubscription?: Subscription;
  private tokenExpiryTime?: number;

  constructor(
    private http: HttpClient,
    private tokenService: TokenService,
    @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel
  ) {
    this.apiHost = environment.apiServer.host;
    this.authConfig = {
      mode: environment.auth?.mode || 'cookie',
      refreshEndpoint: environment.auth?.refreshEndpoint || '/auth/refresh',
      useCsrf: environment.auth?.useCsrf !== undefined ? environment.auth.useCsrf : true,
      refreshTokenCookieName: environment.auth?.refreshTokenCookieName || 'refresh_token',
      csrfTokenCookieName: environment.auth?.csrfTokenCookieName || 'csrf_token',
      csrfHeaderName: environment.auth?.csrfHeaderName || 'X-CSRF-Token'
    };

    // Initialize state from stored tokens if available
    this.initializeAuthState();
  }

  /**
   * Login with email and password
   */
  login(
    email: string,
    password: string,
    platformCode: string,
    tenantSlug?: string
  ): Observable<AuthResponse> {
    const url = `${this.apiHost}auth/login`;
    const body = {
      email,
      password,
      platform_code: platformCode,
      tenant_slug: tenantSlug
    };

    return this.http.post<AuthResponse>(url, body, { withCredentials: true }).pipe(
      tap(response => this.handleAuthResponse(response)),
      catchError(error => {
        console.error('Login failed:', error);
        throw error;
      })
    );
  }

  /**
   * Redirect to Google OAuth
   */
  loginWithGoogle(platformCode: string, tenantSlug?: string): void {
    const state: OAuthState = {
      platform_code: platformCode,
      tenant_slug: tenantSlug,
      return_url: window.location.href
    };

    const stateParam = encodeURIComponent(JSON.stringify(state));
    const oauthUrl = `${this.apiHost}auth/google?state=${stateParam}`;

    window.location.href = oauthUrl;
  }

  /**
   * Handle OAuth callback after redirect
   */
  handleOAuthCallback(code: string, state: string): Observable<AuthResponse> {
    const url = `${this.apiHost}auth/google/callback`;
    const body = { code, state };

    return this.http.post<AuthResponse>(url, body, { withCredentials: true }).pipe(
      tap(response => this.handleAuthResponse(response)),
      catchError(error => {
        console.error('OAuth callback failed:', error);
        throw error;
      })
    );
  }

  /**
   * Select tenant using selection token (multi-tenant scenarios)
   */
  selectTenant(selectionToken: string, tenantId: number): Observable<AuthResponse> {
    const url = `${this.apiHost}auth/select-tenant`;
    const body = {
      selection_token: selectionToken,
      tenant_id: tenantId
    };

    return this.http.post<AuthResponse>(url, body, { withCredentials: true }).pipe(
      tap(response => this.handleAuthResponse(response)),
      catchError(error => {
        console.error('Tenant selection failed:', error);
        throw error;
      })
    );
  }

  /**
   * Switch to a different tenant (requires active session)
   */
  switchTenant(tenantId: number): Observable<AuthResponse> {
    const url = `${this.apiHost}auth/switch-tenant`;
    const body = { tenant_id: tenantId };

    return this.http.post<AuthResponse>(url, body, { withCredentials: true }).pipe(
      tap(response => this.handleAuthResponse(response)),
      catchError(error => {
        console.error('Tenant switch failed:', error);
        throw error;
      })
    );
  }

  /**
   * Refresh access token
   */
  refreshToken(): Observable<RefreshTokenResponse> {
    const url = `${this.apiHost}${this.authConfig.refreshEndpoint!.replace(/^\/+/, '')}`;

    const options = this.authConfig.mode === 'cookie'
      ? { withCredentials: true }
      : {};

    const body = this.authConfig.mode === 'body'
      ? {
          access_token: this.tokenService.getAccessToken(),
          refresh_token: this.tokenService.getRefreshToken()
        }
      : {};

    return this.http.post<RefreshTokenResponse>(url, body, options).pipe(
      tap(response => {
        if (response.access_token) {
          this.tokenService.setAccessToken(response.access_token);
          this.scheduleTokenRefresh(response.expires_in);
        }
      }),
      catchError(error => {
        console.error('Token refresh failed:', error);
        this.clearAuthState();
        throw error;
      })
    );
  }

  /**
   * Logout user
   */
  logout(): void {
    const url = `${this.apiHost}auth/logout`;
    const refreshToken = this.tokenService.getRefreshToken();

    const body = this.authConfig.mode === 'body' && refreshToken
      ? { refresh_token: refreshToken }
      : {};

    const options = this.authConfig.mode === 'cookie'
      ? { withCredentials: true }
      : {};

    // Fire and forget - clear state immediately
    this.http.post(url, body, options).subscribe({
      error: (err) => console.error('Logout request failed:', err)
    });

    this.clearAuthState();
  }

  /**
   * Get current identity
   */
  getCurrentIdentity(): Identity | null {
    return this.identitySubject.value;
  }

  /**
   * Get current membership
   */
  getCurrentMembership(): Membership | null {
    return this.membershipSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const hasToken = !!this.tokenService.getAccessToken();
    const hasIdentity = !!this.identitySubject.value;
    return hasToken && hasIdentity;
  }

  /**
   * Handle authentication response and update state
   */
  private handleAuthResponse(response: AuthResponse): void {
    // Store tokens
    if (response.access_token) {
      if (this.authConfig.mode === 'body' && response.refresh_token) {
        this.tokenService.setTokens(response.access_token, response.refresh_token);
      } else {
        this.tokenService.setAccessToken(response.access_token);
      }

      // Schedule auto-refresh
      this.scheduleTokenRefresh(response.expires_in);
    }

    // Update identity
    if (response.identity) {
      this.identitySubject.next(response.identity);
      this.storeIdentity(response.identity);
    }

    // Update membership
    if (response.membership) {
      this.membershipSubject.next(response.membership);
      this.storeMembership(response.membership);
    }
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    // Cancel existing timer
    if (this.refreshTimerSubscription) {
      this.refreshTimerSubscription.unsubscribe();
    }

    // Calculate refresh time (refresh 60 seconds before expiry)
    const refreshBuffer = 60 * 1000; // 60 seconds
    const refreshDelay = (expiresIn * 1000) - refreshBuffer;

    if (refreshDelay > 0) {
      this.tokenExpiryTime = Date.now() + (expiresIn * 1000);

      // Schedule refresh
      this.refreshTimerSubscription = interval(refreshDelay).subscribe(() => {
        this.refreshToken().subscribe({
          error: (err) => {
            console.error('Auto-refresh failed:', err);
            this.clearAuthState();
          }
        });
      });
    }
  }

  /**
   * Initialize authentication state from storage
   */
  private initializeAuthState(): void {
    const storedIdentity = this.getStoredIdentity();
    const storedMembership = this.getStoredMembership();

    if (storedIdentity) {
      this.identitySubject.next(storedIdentity);
    }

    if (storedMembership) {
      this.membershipSubject.next(storedMembership);
    }

    // If we have a token, try to refresh it to ensure it's valid
    if (this.tokenService.getAccessToken() && this.authConfig.mode !== 'none') {
      this.refreshToken().subscribe({
        error: () => this.clearAuthState()
      });
    }
  }

  /**
   * Clear authentication state
   */
  private clearAuthState(): void {
    this.tokenService.clear();
    this.identitySubject.next(null);
    this.membershipSubject.next(null);

    if (this.refreshTimerSubscription) {
      this.refreshTimerSubscription.unsubscribe();
      this.refreshTimerSubscription = undefined;
    }

    this.tokenExpiryTime = undefined;

    // Clear from localStorage
    localStorage.removeItem('auth_identity');
    localStorage.removeItem('auth_membership');
  }

  /**
   * Store identity in localStorage for persistence
   */
  private storeIdentity(identity: Identity): void {
    localStorage.setItem('auth_identity', JSON.stringify(identity));
  }

  /**
   * Store membership in localStorage for persistence
   */
  private storeMembership(membership: Membership): void {
    localStorage.setItem('auth_membership', JSON.stringify(membership));
  }

  /**
   * Retrieve identity from localStorage
   */
  private getStoredIdentity(): Identity | null {
    const stored = localStorage.getItem('auth_identity');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored identity:', e);
        return null;
      }
    }
    return null;
  }

  /**
   * Retrieve membership from localStorage
   */
  private getStoredMembership(): Membership | null {
    const stored = localStorage.getItem('auth_membership');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored membership:', e);
        return null;
      }
    }
    return null;
  }
}
