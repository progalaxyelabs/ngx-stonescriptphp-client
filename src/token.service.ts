import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class TokenService {
    private accessToken = ''
    private refreshToken = ''

    private lsAccessTokenKey = 'progalaxyapi_access_token'
    private lsRefreshTokenKey = 'progalaxyapi_refresh_token'

    constructor() { }

    setTokens(accessToken: string, refreshToken: string) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
        localStorage.setItem(this.lsAccessTokenKey, accessToken)
        localStorage.setItem(this.lsRefreshTokenKey, refreshToken)
    }

    setAccessToken(accessToken: string) {
        this.accessToken = accessToken
        localStorage.setItem(this.lsAccessTokenKey, accessToken)
    }

    setRefreshToken(refreshToken: string) {
        this.refreshToken = refreshToken
        localStorage.setItem(this.lsRefreshTokenKey, refreshToken)
    }

    getAccessToken() {
        if (this.accessToken) {
            return this.accessToken
        }

        const storedAccessToken = localStorage.getItem(this.lsAccessTokenKey)
        if (storedAccessToken) {
            return storedAccessToken
        } else {
            return ''
        }
    }

    getRefreshToken() {
        if (this.refreshToken) {
            return this.refreshToken
        }

        const storedRefreshToken = localStorage.getItem(this.lsRefreshTokenKey)
        if (storedRefreshToken) {
            return storedRefreshToken
        } else {
            return ''
        }
    }

    clear() {
        this.accessToken = ''
        this.refreshToken = ''
        localStorage.removeItem(this.lsAccessTokenKey)
        localStorage.removeItem(this.lsRefreshTokenKey)
    }

    /**
     * Check if there is a non-empty access token.
     * Token is treated as opaque — validity is determined by the auth server.
     */
    hasValidAccessToken(): boolean {
        const token = this.getAccessToken()
        return token !== null && token !== ''
    }

    /**
     * Decode the payload of a JWT without verifying the signature.
     * Returns the parsed claims object, or null if the token is invalid/missing.
     *
     * Usage: const claims = tokenService.decodeJwtPayload(token);
     *        const role = claims?.role;
     */
    decodeJwtPayload(token?: string): Record<string, any> | null {
        const jwt = token ?? this.getAccessToken()
        if (!jwt) return null
        try {
            const parts = jwt.split('.')
            if (parts.length !== 3) return null
            // Base64url → Base64 → JSON
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
            const json = atob(padded)
            return JSON.parse(json)
        } catch {
            return null
        }
    }
}
