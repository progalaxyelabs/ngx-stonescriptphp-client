import { Injectable, Inject } from '@angular/core';
import { BuiltInProvider } from './auth.service';
import { MyEnvironmentModel, OAuthProviderConfig } from './my-environment.model';

/**
 * Default configurations for built-in OAuth providers.
 * These serve as fallback values when no custom configuration is registered.
 */
const BUILT_IN_PROVIDERS: Record<BuiltInProvider, OAuthProviderConfig> = {
    google: {
        label: 'Google',
        cssClass: 'btn-google',
        buttonStyle: { borderColor: '#4285f4' }
    },
    linkedin: {
        label: 'LinkedIn',
        cssClass: 'btn-linkedin',
        buttonStyle: { borderColor: '#0077b5' }
    },
    apple: {
        label: 'Apple',
        cssClass: 'btn-apple',
        buttonStyle: { borderColor: '#000' }
    },
    microsoft: {
        label: 'Microsoft',
        cssClass: 'btn-microsoft',
        buttonStyle: { borderColor: '#00a4ef' }
    },
    github: {
        label: 'GitHub',
        cssClass: 'btn-github',
        buttonStyle: { borderColor: '#333' }
    },
    zoho: {
        label: 'Zoho',
        icon: '🔶',
        cssClass: 'btn-zoho',
        buttonStyle: {
            borderColor: '#d63b32',
            backgroundColor: '#f0483e',
            color: '#ffffff'
        }
    },
    emailPassword: {
        label: 'Email',
        cssClass: 'btn-email'
    }
};

/**
 * Service for managing OAuth provider configurations.
 *
 * Provides a central registry for both built-in and custom OAuth providers.
 * Custom providers can be registered either through the environment configuration
 * (customProviders field) or programmatically via registerProvider/registerProviders.
 *
 * Custom registrations take precedence over built-in defaults.
 * Unknown providers receive an auto-generated fallback configuration.
 */
@Injectable({
    providedIn: 'root'
})
export class ProviderRegistryService {
    private customProviders = new Map<string, OAuthProviderConfig>();

    constructor(
        @Inject(MyEnvironmentModel) private environment: MyEnvironmentModel
    ) {
        // Seed from environment customProviders if present
        if (this.environment.customProviders) {
            for (const [id, config] of Object.entries(this.environment.customProviders)) {
                this.customProviders.set(id, config);
            }
        }
    }

    /**
     * Register a custom OAuth provider configuration.
     * If a provider with the same id already exists, it will be overwritten.
     * @param id - Provider identifier (e.g., 'okta', 'auth0')
     * @param config - Provider display configuration
     */
    registerProvider(id: string, config: OAuthProviderConfig): void {
        this.customProviders.set(id, config);
    }

    /**
     * Register multiple custom OAuth provider configurations at once.
     * @param providers - Record of provider id to configuration
     */
    registerProviders(providers: Record<string, OAuthProviderConfig>): void {
        for (const [id, config] of Object.entries(providers)) {
            this.customProviders.set(id, config);
        }
    }

    /**
     * Get the full configuration for a provider.
     * Resolution order: custom registration > built-in default > auto-generated fallback.
     * @param provider - Provider identifier
     */
    getProviderConfig(provider: string): OAuthProviderConfig {
        // 1. Check custom registrations first
        const custom = this.customProviders.get(provider);
        if (custom) {
            return custom;
        }

        // 2. Check built-in providers
        const builtIn = BUILT_IN_PROVIDERS[provider as BuiltInProvider];
        if (builtIn) {
            return builtIn;
        }

        // 3. Auto-generated fallback for unknown providers
        const displayName = provider.charAt(0).toUpperCase() + provider.slice(1);
        return {
            label: displayName,
            cssClass: `btn-${provider}`
        };
    }

    /**
     * Get the display label for a provider, formatted for sign-in context.
     * @param provider - Provider identifier
     * @returns Label like "Sign in with Google"
     */
    getLabel(provider: string): string {
        const config = this.getProviderConfig(provider);
        if (provider === 'emailPassword') {
            return `Sign in with ${config.label}`;
        }
        return `Sign in with ${config.label}`;
    }

    /**
     * Get the display label for a provider, formatted for sign-up context.
     * @param provider - Provider identifier
     * @returns Label like "Sign up with Google"
     */
    getSignupLabel(provider: string): string {
        const config = this.getProviderConfig(provider);
        return `Sign up with ${config.label}`;
    }

    /**
     * Get the icon for a provider, if configured.
     * @param provider - Provider identifier
     * @returns Icon string or undefined
     */
    getIcon(provider: string): string | undefined {
        const config = this.getProviderConfig(provider);
        return config.icon;
    }

    /**
     * Get the CSS class for a provider button.
     * @param provider - Provider identifier
     * @returns CSS class string (e.g., "btn-google")
     */
    getCssClass(provider: string): string {
        const config = this.getProviderConfig(provider);
        return config.cssClass || `btn-${provider}`;
    }

    /**
     * Get inline button styles for a provider, if configured.
     * @param provider - Provider identifier
     * @returns Style object for ngStyle binding, or null if no custom styles
     */
    getButtonStyle(provider: string): Record<string, string> | null {
        const config = this.getProviderConfig(provider);
        if (!config.buttonStyle) {
            return null;
        }

        const styles: Record<string, string> = {};
        if (config.buttonStyle.borderColor) {
            styles['border-color'] = config.buttonStyle.borderColor;
        }
        if (config.buttonStyle.backgroundColor) {
            styles['background-color'] = config.buttonStyle.backgroundColor;
        }
        if (config.buttonStyle.color) {
            styles['color'] = config.buttonStyle.color;
        }
        return Object.keys(styles).length > 0 ? styles : null;
    }
}
