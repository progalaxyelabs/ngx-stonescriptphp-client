import { Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { ApiResponse } from './api-response.model';
import { MyEnvironmentModel } from './my-environment.model';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class ApiConnectionService {

    private host = '' // base URL without trailing slash

    constructor(
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        private environment: MyEnvironmentModel,
        private authService: AuthService
    ) {
        this.host = environment.apiServer.host
    }

    private async request<DataType>(url: string, options: any, data: any | null): Promise<ApiResponse<DataType>> {
        try {
            if (data !== null) {
                const body = JSON.stringify(data)
                options.body = body || {}
            }

            const accessTokenIncluded = this.includeAccessToken(options)

            let response: Response = await fetch(url, options)

            if (response.status === 401 && accessTokenIncluded) {
                response = await this.refreshAndRetry(url, options, response)
            }

            if (response.ok) {
                const json = await response.json()
                return new ApiResponse<DataType>(json.status, json.data, json.message)
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
        console.error(`Backend returned code ${error.status}, full error: `, error)
        return new ApiResponse<DataType>('error')
    }

    async get<DataType>(endpoint: string, queryParamsObj?: any): Promise<ApiResponse<DataType>> {
        const url = this.host + endpoint + this.buildQueryString(queryParamsObj)
        const fetchOptions: RequestInit = { mode: 'cors', redirect: 'error' }
        return this.request(url, fetchOptions, null)
    }

    async post<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams
        const fetchOptions: RequestInit = {
            method: 'POST',
            mode: 'cors',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }
        return this.request(url, fetchOptions, data)
    }

    async delete<DataType>(endpoint: string, queryParamsObj?: any): Promise<ApiResponse<DataType>> {
        const url = this.host + endpoint + this.buildQueryString(queryParamsObj)
        const fetchOptions: RequestInit = { method: 'DELETE', mode: 'cors', redirect: 'error' }
        return this.request(url, fetchOptions, null)
    }

    private includeAccessToken(options: any): boolean {
        const accessToken = this.tokens.getAccessToken()
        if (!accessToken) return false
        if (!options.headers) options.headers = {}
        options.headers['Authorization'] = 'Bearer ' + accessToken
        return true
    }

    private async refreshAndRetry(url: string, fetchOptions: any, response: Response): Promise<Response> {
        const refreshed = await this.authService.refresh()
        if (!refreshed) return response
        fetchOptions.headers['Authorization'] = 'Bearer ' + this.tokens.getAccessToken()
        return fetch(url, fetchOptions)
    }

    /**
     * Refresh the access token (delegates to AuthService → AuthPlugin).
     * Kept public for backward compatibility.
     */
    async refreshAccessToken(): Promise<boolean> {
        return this.authService.refresh()
    }

    buildQueryString(options?: any): string {
        if (options === undefined) return ''
        const array = []
        for (const key in options) {
            if (options.hasOwnProperty(key) && options[key] !== null && options[key] !== undefined) {
                array.push(encodeURIComponent(key) + '=' + encodeURIComponent(options[key]))
            }
        }
        const str = array.join('&')
        return str ? '?' + str : ''
    }

    /**
     * Upload a drawing (uses upload server if configured, otherwise API server)
     * @deprecated Platform-specific method - consider moving to platform service
     */
    async uploadDrawing<DataType>(formData: FormData): Promise<ApiResponse<DataType>> {
        const uploadHost = (this.environment as any).uploadServer?.host || this.host
        const url = uploadHost + '/upload/drawing'
        const fetchOptions: RequestInit = { method: 'POST', mode: 'cors', redirect: 'error', body: formData }
        return this.request(url, fetchOptions, null)
    }

    /**
     * Upload an image (uses upload server if configured, otherwise API server)
     * @deprecated Platform-specific method - consider moving to platform service
     */
    async uploadImage<DataType>(formData: FormData): Promise<ApiResponse<DataType>> {
        const uploadHost = (this.environment as any).uploadServer?.host || this.host
        const url = uploadHost + '/upload/image'
        const fetchOptions: RequestInit = { method: 'POST', mode: 'cors', redirect: 'error', body: formData }
        return this.request(url, fetchOptions, null)
    }
}
