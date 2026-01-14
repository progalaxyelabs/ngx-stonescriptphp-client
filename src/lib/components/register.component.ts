import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth.service';

@Component({
    selector: 'lib-register',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="register-dialog">
            <h2 class="register-title">Create Account</h2>

            <form (ngSubmit)="onRegister()" class="register-form">
                <div class="form-group">
                    <label for="displayName">Full Name</label>
                    <input
                        id="displayName"
                        [(ngModel)]="displayName"
                        name="displayName"
                        placeholder="Enter your full name"
                        type="text"
                        required
                        class="form-control">
                </div>

                <div class="form-group">
                    <label for="email">Email</label>
                    <input
                        id="email"
                        [(ngModel)]="email"
                        name="email"
                        placeholder="Enter your email"
                        type="email"
                        required
                        class="form-control">
                </div>

                <div class="form-group">
                    <label for="password">Password</label>
                    <input
                        id="password"
                        [(ngModel)]="password"
                        name="password"
                        placeholder="Create a password"
                        type="password"
                        required
                        minlength="8"
                        class="form-control">
                    <small class="form-hint">At least 8 characters</small>
                </div>

                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input
                        id="confirmPassword"
                        [(ngModel)]="confirmPassword"
                        name="confirmPassword"
                        placeholder="Confirm your password"
                        type="password"
                        required
                        class="form-control">
                </div>

                <button
                    type="submit"
                    [disabled]="loading"
                    class="btn btn-primary btn-block">
                    {{ loading ? 'Creating account...' : 'Sign Up' }}
                </button>
            </form>

            <!-- Error Message -->
            @if (error) {
                <div class="error-message">
                    {{ error }}
                </div>
            }

            <!-- Success Message -->
            @if (success) {
                <div class="success-message">
                    {{ success }}
                </div>
            }

            <!-- Loading State -->
            @if (loading) {
                <div class="loading-overlay">
                    <div class="spinner"></div>
                </div>
            }

            <!-- Login Link -->
            <div class="login-link">
                Already have an account?
                <a href="#" (click)="onLoginClick($event)">Sign in</a>
            </div>
        </div>
    `,
    styles: [`
        .register-dialog {
            padding: 24px;
            max-width: 400px;
            position: relative;
        }

        .register-title {
            margin: 0 0 24px 0;
            font-size: 24px;
            font-weight: 500;
            text-align: center;
        }

        .register-form {
            margin-bottom: 16px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #333;
        }

        .form-control {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }

        .form-control:focus {
            outline: none;
            border-color: #4285f4;
        }

        .form-hint {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            color: #666;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .btn-block {
            width: 100%;
        }

        .btn-primary {
            background-color: #4285f4;
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            background-color: #357ae8;
        }

        .error-message {
            margin-top: 16px;
            padding: 12px;
            background: #fee;
            color: #c33;
            border-radius: 4px;
            font-size: 14px;
        }

        .success-message {
            margin-top: 16px;
            padding: 12px;
            background: #efe;
            color: #3a3;
            border-radius: 4px;
            font-size: 14px;
        }

        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4285f4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .login-link {
            margin-top: 16px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }

        .login-link a {
            color: #4285f4;
            text-decoration: none;
        }

        .login-link a:hover {
            text-decoration: underline;
        }
    `]
})
export class RegisterComponent {
    displayName = '';
    email = '';
    password = '';
    confirmPassword = '';
    error = '';
    success = '';
    loading = false;

    constructor(private auth: AuthService) {}

    async onRegister() {
        // Reset messages
        this.error = '';
        this.success = '';

        // Validate fields
        if (!this.displayName || !this.email || !this.password || !this.confirmPassword) {
            this.error = 'Please fill in all fields';
            return;
        }

        if (this.password.length < 8) {
            this.error = 'Password must be at least 8 characters';
            return;
        }

        if (this.password !== this.confirmPassword) {
            this.error = 'Passwords do not match';
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.email)) {
            this.error = 'Please enter a valid email address';
            return;
        }

        this.loading = true;

        try {
            const result = await this.auth.register(this.email, this.password, this.displayName);

            if (result.success) {
                this.success = result.message || 'Account created successfully!';
                // On success, parent component/dialog should close automatically via user$ subscription
                // or navigate to email verification page
            } else {
                this.error = result.message || 'Registration failed';
            }
        } catch (err) {
            this.error = 'An unexpected error occurred';
        } finally {
            this.loading = false;
        }
    }

    onLoginClick(event: Event) {
        event.preventDefault();
        // Platforms can override this or listen for a custom event
        // For now, just emit a console message
        console.log('Login clicked - platform should handle navigation');
    }
}
