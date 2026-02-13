import { Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { ApiResponse } from './api-response.model';
import { MyEnvironmentModel, AuthConfig } from './my-environment.model';
import { CsrfService } from './csrf.service';

@Injectable({
    providedIn: 'root'
})
export class ApiConnectionService {

    private host = '' // base URL without trailing slash

    private accessToken = ''

    private authConfig: AuthConfig

    constructor(
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        private environment: MyEnvironmentModel,
        private csrf: CsrfService
    ) {
        this.host = environment.apiServer.host

        // Set default auth config based on mode
        this.authConfig = {
            mode: environment.auth?.mode || 'cookie',
            refreshEndpoint: environment.auth?.refreshEndpoint,
            useCsrf: environment.auth?.useCsrf,
            refreshTokenCookieName: environment.auth?.refreshTokenCookieName || 'refresh_token',
            csrfTokenCookieName: environment.auth?.csrfTokenCookieName || 'csrf_token',
            csrfHeaderName: environment.auth?.csrfHeaderName || 'X-CSRF-Token'
        }

        // Set default refresh endpoint based on mode if not specified
        if (!this.authConfig.refreshEndpoint) {
            this.authConfig.refreshEndpoint = this.authConfig.mode === 'cookie'
                ? '/auth/refresh'
                : '/user/refresh_access'
        }

        // Set default CSRF setting based on mode if not specified
        if (this.authConfig.useCsrf === undefined) {
            this.authConfig.useCsrf = this.authConfig.mode === 'cookie'
        }
    }


    private async request<DataType>(url: string, options: any, data: any | null): Promise<ApiResponse<DataType>> {
        try {
            
            if(data !== null) {
                const body = JSON.stringify(data)
                if(body) {
                    options.body = body
                } else {
                    options.body = {}
                }
            }

            const accessTokenIncluded = this.includeAccessToken(options)

            let response: Response = await fetch(url, options)

            if ((response.status === 401) && accessTokenIncluded) {
                response = await this.refreshAccessTokenAndRetry(url, options, response)
            }

            if (response.ok) {
                const json = await (response.json())
                return (new ApiResponse<DataType>(json.status, json.data, json.message))
            }

            if (response.status === 401) {
                this.signinStatus.signedOut()
            }

            return this.handleError<DataType>(response)
        } catch (error) {
            return this.handleError<DataType>(error)
        }
    }

    private handleError<DataType>(error: any): ApiResponse<DataType> {
        console.error(
            `Backend returned code ${error.status}, ` +
            `full error: `, error);
        return new ApiResponse<DataType>('error')
    }

    async get<DataType>(endpoint: string, queryParamsObj?: any ): Promise<ApiResponse<DataType>> {
        const url = this.host + endpoint + this.buildQueryString(queryParamsObj)
        const fetchOptions: RequestInit = {
            mode: 'cors',
            redirect: 'error'
        }
        return this.request(url, fetchOptions, null)
    }

    async post<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams
        const fetchOptions: RequestInit = {
            method: 'POST',
            mode: 'cors',
            redirect: 'error',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }
        return this.request(url, fetchOptions, data)
    }

    async put<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams
        const fetchOptions: RequestInit = {
            method: 'PUT',
            mode: 'cors',
            redirect: 'error',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }
        return this.request(url, fetchOptions, data)
    }

    async patch<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams
        const fetchOptions: RequestInit = {
            method: 'PATCH',
            mode: 'cors',
            redirect: 'error',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }
        return this.request(url, fetchOptions, data)
    }

    async delete<DataType>(endpoint: string, queryParamsObj?: any): Promise<ApiResponse<DataType>> {
        const url = this.host + endpoint + this.buildQueryString(queryParamsObj)
        const fetchOptions: RequestInit = {
            method: 'DELETE',
            mode: 'cors',
            redirect: 'error'
        }
        return this.request(url, fetchOptions, null)
    }

    // async postFormWithFiles(pathWithQueryParams: string, formData: FormData): Promise<ApiResponse | null> {
    //     const url = this.host + pathWithQueryParams.replace(/^\/+/, '')
    //     try {
    //         const fetchOptions: RequestInit = {
    //             method: 'POST',
    //             mode: 'cors',
    //             redirect: 'error',
    //             body: formData
    //         }

    //         const accessTokenIncluded = this.includeAccessToken(fetchOptions)

    //         let response: Response = await fetch(url, fetchOptions)

    //         if ((response.status === 401) && accessTokenIncluded) {
    //             response = await this.refreshAccessTokenAndRetry(url, fetchOptions, response)
    //         }

    //         if (response.ok) {
    //             return ((await (response.json()) as ApiResponse))
    //         }

    //         return this.handleError(response)
    //     } catch (error) {
    //         return this.handleError(error)
    //     }
    // }

    private includeAccessToken(options: any): boolean {
        this.accessToken = this.tokens.getAccessToken()
        if (!this.accessToken) {
            return false
        }

        if (!options.headers) {
            options.headers = {}
        }
        options.headers['Authorization'] = 'Bearer ' + this.accessToken
        return true
    }

    private async refreshAccessTokenAndRetry(url: string, fetchOptions: any, response: Response): Promise<Response> {

        const refreshStatusOk = await this.refreshAccessToken()
        if (!refreshStatusOk) {
            return response
        }

        fetchOptions.headers['Authorization'] = 'Bearer ' + this.accessToken
        response = await fetch(url, fetchOptions)
        return response
    }

    async refreshAccessToken(): Promise<boolean> {
        if (this.authConfig.mode === 'none') {
            return false
        }

        if (this.authConfig.mode === 'cookie') {
            return await this.refreshAccessTokenCookieMode()
        } else {
            return await this.refreshAccessTokenBodyMode()
        }
    }

    /**
     * Refresh access token using cookie-based auth (StoneScriptPHP v2.1.x default)
     */
    private async refreshAccessTokenCookieMode(): Promise<boolean> {
        try {
            // Handle both absolute URLs (different server) and relative paths (same server)
            const refreshTokenUrl = this.authConfig.refreshEndpoint!.startsWith('http')
                ? this.authConfig.refreshEndpoint!
                : this.host + this.authConfig.refreshEndpoint!
            const headers: any = {
                'Content-Type': 'application/json'
            }

            // Add CSRF token if enabled
            if (this.authConfig.useCsrf) {
                const csrfToken = this.csrf.getCsrfToken(this.authConfig.csrfTokenCookieName!)
                if (!csrfToken) {
                    console.error('CSRF token not found in cookie')
                    return false
                }
                headers[this.authConfig.csrfHeaderName!] = csrfToken
            }

            let refreshTokenResponse = await fetch(refreshTokenUrl, {
                method: 'POST',
                mode: 'cors',
                credentials: 'include', // Important: send cookies
                redirect: 'error',
                headers: headers
            })

            if (!refreshTokenResponse.ok) {
                this.accessToken = ''
                this.tokens.clear()
                return false
            }

            let refreshAccessData = await refreshTokenResponse.json()
            if (!refreshAccessData || refreshAccessData.status !== 'ok') {
                return false
            }

            // Extract access token from response
            const newAccessToken = refreshAccessData.data?.access_token || refreshAccessData.access_token
            if (!newAccessToken) {
                console.error('No access token in refresh response')
                return false
            }

            // Store new access token (refresh token is in httpOnly cookie)
            this.tokens.setAccessToken(newAccessToken)
            this.accessToken = newAccessToken

            return true
        } catch (error) {
            console.error('Token refresh failed (cookie mode):', error)
            this.accessToken = ''
            this.tokens.clear()
            return false
        }
    }

    /**
     * Refresh access token using body-based auth (legacy mode)
     */
    private async refreshAccessTokenBodyMode(): Promise<boolean> {
        try {
            const refreshToken = this.tokens.getRefreshToken()
            if (!refreshToken) {
                return false
            }

            // Handle both absolute URLs (different server) and relative paths (same server)
            const refreshTokenUrl = this.authConfig.refreshEndpoint!.startsWith('http')
                ? this.authConfig.refreshEndpoint!
                : this.host + this.authConfig.refreshEndpoint!
            let refreshTokenResponse = await fetch(refreshTokenUrl, {
                method: 'POST',
                mode: 'cors',
                redirect: 'error',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    access_token: this.accessToken,
                    refresh_token: refreshToken
                })
            })

            if (!refreshTokenResponse.ok) {
                this.accessToken = ''
                this.tokens.clear()
                return false
            }

            let refreshAccessData = await refreshTokenResponse.json()
            if (!refreshAccessData) {
                return false
            }

            const newAccessToken = refreshAccessData.data?.access_token || refreshAccessData.access_token
            if (!newAccessToken) {
                console.error('No access token in refresh response')
                return false
            }

            this.tokens.setTokens(newAccessToken, refreshToken)
            this.accessToken = newAccessToken

            return true
        } catch (error) {
            console.error('Token refresh failed (body mode):', error)
            this.accessToken = ''
            this.tokens.clear()
            return false
        }
    }

    buildQueryString(options?: any): string {
        if (options === undefined) {
            return ''
        }

        const array = []
        for (let key in options) {
            if (options.hasOwnProperty(key) && (options[key] !== null) && (options[key] !== undefined)) {
                array.push(encodeURIComponent(key) + "=" + encodeURIComponent(options[key]))
            }
        }
        const str = array.join('&')
        if (str !== '') {
            return '?' + str
        }

        return ''
    }

    /**
     * Upload a drawing (uses upload server if configured, otherwise API server)
     * @deprecated Platform-specific method - consider moving to platform service
     */
    async uploadDrawing<DataType>(formData: FormData): Promise<ApiResponse<DataType>> {
        const uploadHost = (this.environment as any).uploadServer?.host || this.host
        const url = uploadHost + '/upload/drawing'
        const fetchOptions: RequestInit = {
            method: 'POST',
            mode: 'cors',
            redirect: 'error',
            body: formData
        }
        return this.request(url, fetchOptions, null)
    }

    /**
     * Upload an image (uses upload server if configured, otherwise API server)
     * @deprecated Platform-specific method - consider moving to platform service
     */
    async uploadImage<DataType>(formData: FormData): Promise<ApiResponse<DataType>> {
        const uploadHost = (this.environment as any).uploadServer?.host || this.host
        const url = uploadHost + '/upload/image'
        const fetchOptions: RequestInit = {
            method: 'POST',
            mode: 'cors',
            redirect: 'error',
            body: formData
        }
        return this.request(url, fetchOptions, null)
    }
}
