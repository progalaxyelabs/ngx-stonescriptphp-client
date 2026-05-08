import { Injectable, Inject, Optional } from '@angular/core';
import { TokenService } from './token.service';
import { ApiResponse, MyEnvironmentModel } from '@progalaxyelabs/stonescriptphp-client-core';
import { AuthService } from './auth.service';
import { NOTIFICATION_HANDLER, NotificationHandler } from './notification-handler';

/**
 * API connection service for making authenticated HTTP requests.
 *
 * Features:
 * - Automatic Bearer token injection
 * - Automatic 401 retry with token refresh
 * - Standard ApiResponse<T> format handling
 * - Optional notification handler for error display
 */
@Injectable({
    providedIn: 'root'
})
export class ApiConnectionService {

    private host = ''; // base URL without trailing slash

    constructor(
        private tokens: TokenService,
        @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel,
        private authService: AuthService,
        @Optional() @Inject(NOTIFICATION_HANDLER) private notificationHandler: NotificationHandler | null
    ) {
        this.host = environment.apiServer.host;
    }

    private async request<DataType>(url: string, options: any, data: any | null): Promise<ApiResponse<DataType>> {
        try {
            if (data !== null) {
                const body = JSON.stringify(data);
                options.body = body || {};
            }

            const accessTokenIncluded = this.includeAccessToken(options);

            let response: Response = await fetch(url, options);

            if (response.status === 401 && accessTokenIncluded) {
                response = await this.refreshAndRetry(url, options, response);
            }

            if (response.ok) {
                const json = await response.json();
                return new ApiResponse<DataType>(json.status, json.data, json.message);
            }

            if (response.status === 401) {
                this.authService.clearSession();
            }

            return await this.handleError<DataType>(response, options.method || 'GET', url);
        } catch (error) {
            return await this.handleError<DataType>(error, options.method || 'GET', url);
        }
    }

    private async handleError<DataType>(error: any, method: string, requestUrl: string): Promise<ApiResponse<DataType>> {
        // Read response body for HTTP errors
        let responseBody: any = null;
        if (error instanceof Response) {
            try {
                responseBody = await error.json();
            } catch (e) {
                // Response body isn't JSON or already consumed — log and continue
                console.warn('Failed to parse error response as JSON:', e);
            }
        }

        // Preserve error metadata for proper classification
        const errorMetadata: any = {
            originalError: error,
            responseBody,
            isNetworkError: !(error instanceof Response) && (error instanceof TypeError || !error.status),
            httpStatus: error instanceof Response ? error.status : (error.status || null),
            url: requestUrl || error.url || null,
            method: method || null
        };

        const errorMessage = responseBody?.message || 'An error occurred';

        // Notify via handler if provided
        if (this.notificationHandler && errorMessage) {
            this.notificationHandler.error(errorMessage);
        }

        return new ApiResponse<DataType>('error', errorMetadata, errorMessage);
    }

    async get<DataType>(endpoint: string, queryParamsObj?: any): Promise<ApiResponse<DataType>> {
        const url = this.host + endpoint + this.buildQueryString(queryParamsObj);
        const fetchOptions: RequestInit = { mode: 'cors', redirect: 'error' };
        return this.request(url, fetchOptions, null);
    }

    async post<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams;
        const fetchOptions: RequestInit = {
            method: 'POST',
            mode: 'cors',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };
        return this.request(url, fetchOptions, data);
    }

    async put<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams;
        const fetchOptions: RequestInit = {
            method: 'PUT',
            mode: 'cors',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };
        return this.request(url, fetchOptions, data);
    }

    async patch<DataType>(pathWithQueryParams: string, data: any): Promise<ApiResponse<DataType>> {
        const url = this.host + pathWithQueryParams;
        const fetchOptions: RequestInit = {
            method: 'PATCH',
            mode: 'cors',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };
        return this.request(url, fetchOptions, data);
    }

    async delete<DataType>(endpoint: string, queryParamsObj?: any): Promise<ApiResponse<DataType>> {
        const url = this.host + endpoint + this.buildQueryString(queryParamsObj);
        const fetchOptions: RequestInit = { method: 'DELETE', mode: 'cors', redirect: 'error' };
        return this.request(url, fetchOptions, null);
    }

    private includeAccessToken(options: any): boolean {
        const accessToken = this.tokens.getAccessToken();
        if (!accessToken) return false;
        if (!options.headers) options.headers = {};
        options.headers['Authorization'] = 'Bearer ' + accessToken;
        return true;
    }

    private async refreshAndRetry(url: string, fetchOptions: any, response: Response): Promise<Response> {
        const refreshed = await this.authService.refresh();
        if (!refreshed) return response;
        fetchOptions.headers['Authorization'] = 'Bearer ' + this.tokens.getAccessToken();
        return fetch(url, fetchOptions);
    }

    /**
     * Refresh the access token (delegates to AuthService → AuthPlugin).
     * Kept public for backward compatibility.
     */
    async refreshAccessToken(): Promise<boolean> {
        return this.authService.refresh();
    }

    buildQueryString(options?: any): string {
        if (options === undefined || options === null) return '';
        const array: string[] = [];
        for (const key in options) {
            if (options.hasOwnProperty(key) && options[key] !== null && options[key] !== undefined) {
                const value = options[key];
                if (typeof value === 'object' && !Array.isArray(value)) {
                    // Flatten nested objects into top-level params.
                    // e.g. { filters: { status: 'active', item_form_id: 5 } }
                    //   → status=active&item_form_id=5
                    // This prevents passing { filters: {...} } from producing
                    // "filters=%5Bobject%20Object%5D" in the URL.
                    for (const innerKey in value) {
                        if (value.hasOwnProperty(innerKey) && value[innerKey] !== null && value[innerKey] !== undefined) {
                            array.push(encodeURIComponent(innerKey) + '=' + encodeURIComponent(value[innerKey]));
                        }
                    }
                } else {
                    array.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
                }
            }
        }
        const str = array.join('&');
        return str ? '?' + str : '';
    }
}
