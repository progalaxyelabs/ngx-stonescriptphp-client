import { Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { MyEnvironmentModel, AuthConfig } from './my-environment.model';
import { CsrfService } from './csrf.service';
import {
    FileUploadResult,
    FileMetadata,
    FileUploadResponse,
    FileListResponse,
    FileDeleteResponse
} from './files.model';

/**
 * Service for interacting with the stonescriptphp-files server.
 * Handles file upload, download, list, and delete operations
 * with automatic Bearer token injection and 401 refresh handling.
 */
@Injectable({
    providedIn: 'root'
})
export class FilesService {

    private host = '';
    private apiHost = '';
    private authConfig: AuthConfig;

    constructor(
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        private environment: MyEnvironmentModel,
        private csrf: CsrfService
    ) {
        this.host = environment.filesServer?.host || '';
        this.apiHost = environment.apiServer.host;

        this.authConfig = {
            mode: environment.auth?.mode || 'cookie',
            refreshEndpoint: environment.auth?.refreshEndpoint,
            useCsrf: environment.auth?.useCsrf,
            refreshTokenCookieName: environment.auth?.refreshTokenCookieName || 'refresh_token',
            csrfTokenCookieName: environment.auth?.csrfTokenCookieName || 'csrf_token',
            csrfHeaderName: environment.auth?.csrfHeaderName || 'X-CSRF-Token'
        };

        if (!this.authConfig.refreshEndpoint) {
            this.authConfig.refreshEndpoint = this.authConfig.mode === 'cookie'
                ? '/auth/refresh'
                : '/user/refresh_access';
        }

        if (this.authConfig.useCsrf === undefined) {
            this.authConfig.useCsrf = this.authConfig.mode === 'cookie';
        }
    }

    /**
     * Check if the files server is configured.
     */
    isConfigured(): boolean {
        return !!this.host;
    }

    /**
     * Upload a file to the files service.
     * Uses FormData — does NOT set Content-Type header (browser sets multipart boundary).
     *
     * @param file The File object to upload
     * @param entityType Optional entity type for server-side reference linking
     * @param entityId Optional entity ID for server-side reference linking
     * @returns Promise resolving to the upload result
     */
    async upload(file: File, entityType?: string, entityId?: string): Promise<FileUploadResult> {
        const formData = new FormData();
        formData.append('file', file);

        if (entityType) {
            formData.append('entityType', entityType);
        }
        if (entityId) {
            formData.append('entityId', entityId);
        }

        const url = this.host + 'upload';
        const options: RequestInit = {
            method: 'POST',
            mode: 'cors',
            redirect: 'error',
            body: formData
            // No Content-Type header — browser sets multipart boundary automatically
        };

        const response = await this.requestWithRetry<FileUploadResponse>(url, options);
        return response.file;
    }

    /**
     * Download a file from the files service.
     * Returns a Blob suitable for URL.createObjectURL().
     *
     * @param fileId UUID of the file to download
     * @returns Promise resolving to the file Blob
     */
    async download(fileId: string): Promise<Blob> {
        const url = this.host + 'files/' + fileId;
        const options: RequestInit = {
            method: 'GET',
            mode: 'cors',
            redirect: 'error'
        };

        this.includeAccessToken(options);

        let response = await fetch(url, options);

        if (response.status === 401) {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                this.includeAccessToken(options);
                response = await fetch(url, options);
            }
        }

        if (response.status === 401) {
            this.signinStatus.signedOut();
        }

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        return response.blob();
    }

    /**
     * List all files for the current user.
     *
     * @returns Promise resolving to array of file metadata
     */
    async list(): Promise<FileMetadata[]> {
        const url = this.host + 'files';
        const options: RequestInit = {
            method: 'GET',
            mode: 'cors',
            redirect: 'error'
        };

        const response = await this.requestWithRetry<FileListResponse>(url, options);
        return response.files;
    }

    /**
     * Delete a file from the files service.
     *
     * @param fileId UUID of the file to delete
     * @returns Promise resolving to true on success
     */
    async delete(fileId: string): Promise<boolean> {
        const url = this.host + 'files/' + fileId;
        const options: RequestInit = {
            method: 'DELETE',
            mode: 'cors',
            redirect: 'error'
        };

        const response = await this.requestWithRetry<FileDeleteResponse>(url, options);
        return response.success;
    }

    /**
     * Make a request with automatic Bearer token injection and 401 retry.
     */
    private async requestWithRetry<T>(url: string, options: RequestInit): Promise<T> {
        this.includeAccessToken(options);

        let response = await fetch(url, options);

        if (response.status === 401) {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                this.includeAccessToken(options);
                response = await fetch(url, options);
            }
        }

        if (response.status === 401) {
            this.signinStatus.signedOut();
        }

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || `Request failed: ${response.status}`);
        }

        return response.json();
    }

    private includeAccessToken(options: RequestInit): void {
        const accessToken = this.tokens.getAccessToken();
        if (!accessToken) return;

        if (!options.headers) {
            options.headers = {};
        }
        (options.headers as Record<string, string>)['Authorization'] = 'Bearer ' + accessToken;
    }

    private async refreshAccessToken(): Promise<boolean> {
        if (this.authConfig.mode === 'none') {
            return false;
        }

        if (this.authConfig.mode === 'cookie') {
            return this.refreshAccessTokenCookieMode();
        } else {
            return this.refreshAccessTokenBodyMode();
        }
    }

    private async refreshAccessTokenCookieMode(): Promise<boolean> {
        try {
            const refreshTokenUrl = this.apiHost + this.authConfig.refreshEndpoint!.replace(/^\/+/, '');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this.authConfig.useCsrf) {
                const csrfToken = this.csrf.getCsrfToken(this.authConfig.csrfTokenCookieName!);
                if (!csrfToken) {
                    return false;
                }
                headers[this.authConfig.csrfHeaderName!] = csrfToken;
            }

            const response = await fetch(refreshTokenUrl, {
                method: 'POST',
                mode: 'cors',
                credentials: 'include',
                redirect: 'error',
                headers
            });

            if (!response.ok) {
                this.tokens.clear();
                return false;
            }

            const data = await response.json();
            if (!data || data.status !== 'ok') {
                return false;
            }

            const newAccessToken = data.data?.access_token || data.access_token;
            if (!newAccessToken) {
                return false;
            }

            this.tokens.setAccessToken(newAccessToken);
            return true;
        } catch {
            this.tokens.clear();
            return false;
        }
    }

    private async refreshAccessTokenBodyMode(): Promise<boolean> {
        try {
            const refreshToken = this.tokens.getRefreshToken();
            if (!refreshToken) {
                return false;
            }

            const accessToken = this.tokens.getAccessToken();
            const refreshTokenUrl = this.apiHost + this.authConfig.refreshEndpoint!.replace(/^\/+/, '');

            const response = await fetch(refreshTokenUrl, {
                method: 'POST',
                mode: 'cors',
                redirect: 'error',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: accessToken,
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                this.tokens.clear();
                return false;
            }

            const data = await response.json();
            if (!data) {
                return false;
            }

            const newAccessToken = data.data?.access_token || data.access_token;
            if (!newAccessToken) {
                return false;
            }

            this.tokens.setTokens(newAccessToken, refreshToken);
            return true;
        } catch {
            this.tokens.clear();
            return false;
        }
    }
}
