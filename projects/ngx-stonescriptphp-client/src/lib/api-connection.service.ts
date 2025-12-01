import { Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { ApiResponse } from './api-response.model';
import { MyEnvironmentModel } from './my-environment.model';

@Injectable({
    providedIn: 'root'
})
export class ApiConnectionService {

    private host = '' // contains trailing slash

    private accessToken = ''

    constructor(
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        private environment: MyEnvironmentModel
    ) {
        this.host = environment.apiServer.host
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
        const url = this.host + endpoint.replace(/^\/+/, '') + this.buildQueryString(queryParamsObj)
        const fetchOptions: RequestInit = {
            mode: 'cors',
            redirect: 'error'
        }
        return this.request(url, fetchOptions, null)
    }

    async post<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams.replace(/^\/+/, '')
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
        const refreshToken = this.tokens.getRefreshToken()
        if (!refreshToken) {
            return false
        }

        const refreshTokenUrl = this.host + 'user/refresh_access'
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
        this.tokens.setTokens(refreshAccessData.data.access_token, refreshToken)
        this.accessToken = refreshAccessData.data.access_token

        return true
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
}
