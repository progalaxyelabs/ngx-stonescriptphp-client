import { Injectable } from '@angular/core';

/**
 * TokenService handles secure storage of authentication tokens
 *
 * Storage strategy:
 * - Access token: stored in memory (private variable) for security
 * - Refresh token: stored in localStorage with tenant-specific key for multi-tab support
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private accessToken: string | null = null;
  private currentTenantId: string | null = null;

  /**
   * Set both access and refresh tokens
   * @param accessToken JWT access token
   * @param refreshToken JWT refresh token
   * @param tenantId Optional tenant ID for multi-tenant support
   */
  setTokens(accessToken: string, refreshToken: string, tenantId?: string): void {
    this.accessToken = accessToken;

    if (tenantId) {
      this.currentTenantId = tenantId;
      localStorage.setItem(`ssp_refresh_${tenantId}`, refreshToken);
    } else {
      // Fallback to default key if no tenantId provided
      localStorage.setItem('ssp_refresh_token', refreshToken);
    }
  }

  /**
   * Set only the access token (used during token refresh)
   * @param accessToken JWT access token
   */
  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  /**
   * Get the current access token from memory
   * @returns Access token or null if not set
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get the refresh token from localStorage
   * @param tenantId Optional tenant ID to retrieve specific tenant's refresh token
   * @returns Refresh token or null if not found
   */
  getRefreshToken(tenantId?: string): string | null {
    const effectiveTenantId = tenantId || this.currentTenantId;

    if (effectiveTenantId) {
      return localStorage.getItem(`ssp_refresh_${effectiveTenantId}`);
    }

    // Fallback to default key
    return localStorage.getItem('ssp_refresh_token');
  }

  /**
   * Clear all tokens from memory and localStorage
   * @param tenantId Optional tenant ID to clear specific tenant's tokens
   */
  clearTokens(tenantId?: string): void {
    this.accessToken = null;

    if (tenantId) {
      localStorage.removeItem(`ssp_refresh_${tenantId}`);
    } else if (this.currentTenantId) {
      localStorage.removeItem(`ssp_refresh_${this.currentTenantId}`);
      this.currentTenantId = null;
    }

    // Also clear fallback key
    localStorage.removeItem('ssp_refresh_token');
  }

  /**
   * Alias for clearTokens() to maintain compatibility with auth.service.ts
   */
  clear(): void {
    this.clearTokens();
  }

  /**
   * Check if the access token is expired by decoding the JWT
   * @returns true if token is expired or invalid, false otherwise
   */
  isAccessTokenExpired(): boolean {
    if (!this.accessToken) {
      return true;
    }

    try {
      const payload = this.parseJwt(this.accessToken);

      if (!payload || !payload.exp) {
        return true;
      }

      // JWT exp is in seconds, Date.now() is in milliseconds
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();

      return currentTime >= expirationTime;
    } catch (error) {
      console.error('Failed to parse access token:', error);
      return true;
    }
  }

  /**
   * Parse JWT token without verification (client-side only)
   * This extracts the payload for reading claims like exp, sub, etc.
   *
   * WARNING: This does NOT verify the signature. Never trust these claims
   * for security-critical operations. Always verify on the server.
   *
   * @param token JWT token string
   * @returns Decoded payload object or null if parsing fails
   */
  private parseJwt(token: string): any {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');

      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode the payload (second part)
      const payload = parts[1];

      // Base64Url decode
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('JWT parsing error:', error);
      return null;
    }
  }

  /**
   * Get the current tenant ID
   * @returns Current tenant ID or null
   */
  getCurrentTenantId(): string | null {
    return this.currentTenantId;
  }

  /**
   * Set the current tenant ID (useful for tenant switching)
   * @param tenantId Tenant ID to set as current
   */
  setCurrentTenantId(tenantId: string): void {
    this.currentTenantId = tenantId;
  }
}
