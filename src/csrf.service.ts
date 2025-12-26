import { Injectable } from '@angular/core';

/**
 * CSRF Token Service
 *
 * Manages CSRF tokens for cookie-based authentication.
 * Reads CSRF token from cookies and provides it for request headers.
 */
@Injectable({
    providedIn: 'root'
})
export class CsrfService {

    /**
     * Get CSRF token from cookie
     */
    getCsrfToken(cookieName: string = 'csrf_token'): string | null {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === cookieName) {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    /**
     * Check if CSRF token exists
     */
    hasCsrfToken(cookieName: string = 'csrf_token'): boolean {
        return this.getCsrfToken(cookieName) !== null;
    }

    /**
     * Clear CSRF token (for logout)
     * Note: Client-side deletion is limited for httpOnly cookies
     */
    clearCsrfToken(cookieName: string = 'csrf_token'): void {
        // Can only clear non-httpOnly cookies
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
}
