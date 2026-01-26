import { Component, OnInit, Output, EventEmitter, Inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantLoginComponent, TenantSelectedEvent } from './tenant-login.component';
import { RegisterComponent } from './register.component';
import { MyEnvironmentModel } from '../../my-environment.model';
import { AuthProvider } from '../../auth.service';

@Component({
    selector: 'lib-auth-page',
    standalone: true,
    imports: [CommonModule, TenantLoginComponent, RegisterComponent],
    template: `
        <div class="auth-container" [style.background]="gradientStyle">
            <div class="auth-card">
                @if (logo) {
                    <img [src]="logo" [alt]="appName + ' logo'" class="logo">
                }
                <h1 class="app-name">{{ appName }}</h1>
                @if (subtitle) {
                    <p class="subtitle">{{ subtitle }}</p>
                }

                @if (mode === 'login') {
                    <lib-tenant-login
                        [providers]="providers"
                        [allowTenantCreation]="false"
                        (tenantSelected)="onAuthenticated($event)"
                        (createTenant)="mode = 'register'">
                    </lib-tenant-login>
                } @else {
                    <lib-register
                        (navigateToLogin)="mode = 'login'">
                    </lib-register>
                }
            </div>
        </div>
    `,
    styles: [`
        .auth-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .auth-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            width: 100%;
            max-width: 480px;
        }

        .logo {
            display: block;
            max-width: 200px;
            max-height: 80px;
            margin: 0 auto 24px;
        }

        .app-name {
            margin: 0 0 12px 0;
            font-size: 28px;
            font-weight: 600;
            text-align: center;
            color: #1a202c;
        }

        .subtitle {
            margin: 0 0 32px 0;
            font-size: 16px;
            text-align: center;
            color: #718096;
        }

        :host ::ng-deep .tenant-login-dialog,
        :host ::ng-deep .register-dialog {
            padding: 0;
            max-width: none;
        }

        :host ::ng-deep .login-title,
        :host ::ng-deep .register-title {
            display: none;
        }
    `]
})
export class AuthPageComponent implements OnInit {
    @Input() providers: AuthProvider[] = ['google', 'emailPassword'];
    @Output() authenticated = new EventEmitter<TenantSelectedEvent>();

    mode: 'login' | 'register' = 'login';

    appName: string = '';
    logo?: string;
    subtitle?: string;
    gradientStyle: string = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

    constructor(@Inject(MyEnvironmentModel) private environment: MyEnvironmentModel) {}

    ngOnInit() {
        const branding = this.environment.branding;

        if (branding) {
            this.appName = branding.appName || 'Sign In';
            this.logo = branding.logo;
            this.subtitle = branding.subtitle;

            if (branding.gradientStart && branding.gradientEnd) {
                this.gradientStyle = `linear-gradient(135deg, ${branding.gradientStart} 0%, ${branding.gradientEnd} 100%)`;
            } else if (branding.primaryColor) {
                const color = branding.primaryColor;
                this.gradientStyle = `linear-gradient(135deg, ${color} 0%, ${this.adjustColor(color, -20)} 100%)`;
            }
        } else {
            this.appName = 'Sign In';
        }
    }

    onAuthenticated(event: TenantSelectedEvent) {
        this.authenticated.emit(event);
    }

    /**
     * Adjust color brightness (simple implementation)
     * @param color Hex color (e.g., '#667eea')
     * @param percent Percentage to darken (negative) or lighten (positive)
     */
    private adjustColor(color: string, percent: number): string {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    }
}
