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
     * Check if there is a valid (non-empty) access token
     * @returns True if access token exists and is not empty
     */
    hasValidAccessToken(): boolean {
        const token = this.getAccessToken()
        return token !== null && token !== ''
    }
}
