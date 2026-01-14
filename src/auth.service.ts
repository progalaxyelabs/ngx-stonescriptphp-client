import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TokenService } from './token.service';
import { SigninStatusService } from './signin-status.service';
import { MyEnvironmentModel } from './my-environment.model';

export interface User {
    user_id: number;
    email: string;
    display_name: string;
    photo_url?: string;
    is_email_verified: boolean;
}

export interface AuthResult {
    success: boolean;
    message?: string;
    user?: User;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    // Observable user state
    private userSubject = new BehaviorSubject<User | null>(null);
    public user$: Observable<User | null> = this.userSubject.asObservable();

    constructor(
        private tokens: TokenService,
        private signinStatus: SigninStatusService,
        @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel
    ) { }

    /**
     * Login with email and password
     */
    async loginWithEmail(email: string, password: string): Promise<AuthResult> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/login`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // Include cookies for refresh token
                    body: JSON.stringify({
                        email,
                        password,
                        platform: this.environment.platformCode
                    })
                }
            );

            const data = await response.json();

            if (data.success && data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                this.signinStatus.setSigninStatus(true);
                this.userSubject.next(data.user);

                return { success: true, user: data.user };
            }

            return {
                success: false,
                message: data.message || 'Invalid credentials'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Network error. Please try again.'
            };
        }
    }

    /**
     * Login with Google OAuth (popup window)
     */
    async loginWithGoogle(): Promise<AuthResult> {
        return this.loginWithOAuth('google');
    }

    /**
     * Login with GitHub OAuth (popup window)
     */
    async loginWithGitHub(): Promise<AuthResult> {
        return this.loginWithOAuth('github');
    }

    /**
     * Generic OAuth login handler
     * Opens popup window and listens for postMessage
     */
    private async loginWithOAuth(provider: string): Promise<AuthResult> {
        return new Promise((resolve) => {
            const width = 500;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;

            const oauthUrl = `${this.environment.accountsUrl}/oauth/${provider}?` +
                `platform=${this.environment.platformCode}&` +
                `mode=popup`;

            const popup = window.open(
                oauthUrl,
                `${provider}_login`,
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup) {
                resolve({
                    success: false,
                    message: 'Popup blocked. Please allow popups for this site.'
                });
                return;
            }

            // Listen for message from popup
            const messageHandler = (event: MessageEvent) => {
                // Verify origin
                if (event.origin !== new URL(this.environment.accountsUrl).origin) {
                    return;
                }

                if (event.data.type === 'oauth_success') {
                    this.tokens.setAccessToken(event.data.access_token);
                    this.signinStatus.setSigninStatus(true);
                    this.userSubject.next(event.data.user);

                    window.removeEventListener('message', messageHandler);
                    popup.close();

                    resolve({
                        success: true,
                        user: event.data.user
                    });
                } else if (event.data.type === 'oauth_error') {
                    window.removeEventListener('message', messageHandler);
                    popup.close();

                    resolve({
                        success: false,
                        message: event.data.message || 'OAuth login failed'
                    });
                }
            };

            window.addEventListener('message', messageHandler);

            // Check if popup was closed manually
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    resolve({
                        success: false,
                        message: 'Login cancelled'
                    });
                }
            }, 500);
        });
    }

    /**
     * Register new user
     */
    async register(
        email: string,
        password: string,
        displayName: string
    ): Promise<AuthResult> {
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/register`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        email,
                        password,
                        display_name: displayName,
                        platform: this.environment.platformCode
                    })
                }
            );

            const data = await response.json();

            if (data.success && data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                this.signinStatus.setSigninStatus(true);
                this.userSubject.next(data.user);

                return {
                    success: true,
                    user: data.user,
                    message: data.needs_verification ? 'Please verify your email' : undefined
                };
            }

            return {
                success: false,
                message: data.message || 'Registration failed'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Network error. Please try again.'
            };
        }
    }

    /**
     * Sign out user
     */
    async signout(): Promise<void> {
        try {
            await fetch(
                `${this.environment.accountsUrl}/api/auth/logout`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );
        } catch (error) {
            console.error('Logout API call failed:', error);
        } finally {
            this.tokens.clear();
            this.signinStatus.setSigninStatus(false);
            this.userSubject.next(null);
        }
    }

    /**
     * Check for active session (call on app init)
     */
    async checkSession(): Promise<boolean> {
        if (this.tokens.hasValidAccessToken()) {
            this.signinStatus.setSigninStatus(true);
            return true;
        }

        // Try to refresh using httpOnly cookie
        try {
            const response = await fetch(
                `${this.environment.accountsUrl}/api/auth/refresh`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                this.signinStatus.setSigninStatus(false);
                return false;
            }

            const data = await response.json();

            if (data.access_token) {
                this.tokens.setAccessToken(data.access_token);
                this.userSubject.next(data.user);
                this.signinStatus.setSigninStatus(true);
                return true;
            }

            return false;
        } catch (error) {
            this.signinStatus.setSigninStatus(false);
            return false;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.tokens.hasValidAccessToken();
    }

    /**
     * Get current user (synchronous)
     */
    getCurrentUser(): User | null {
        return this.userSubject.value;
    }
}
