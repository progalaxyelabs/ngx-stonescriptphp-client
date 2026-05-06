import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { MyEnvironmentModel, AuthPlugin } from '@progalaxyelabs/stonescriptphp-client-core';
import { StoneScriptPHPAuth } from '@progalaxyelabs/stonescriptphp-auth-client';
import { AUTH_PLUGIN } from './auth.plugin';

/**
 * Configure the ngx-stonescriptphp-client library.
 *
 * @param environment - Library configuration (API server, auth settings, etc.)
 * @param plugin - Optional auth plugin override. Defaults to StoneScriptPHPAuth.
 *   Provide your own plugin to use Firebase, progalaxyelabs-auth, Okta, or any other auth backend.
 *
 * @example Default (StoneScriptPHP backend)
 * ```typescript
 * // app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideNgxStoneScriptPhpClient(environment)
 *   ]
 * };
 * ```
 *
 * @example External auth plugin
 * ```typescript
 * import { ProgalaxyElabsAuth } from '@progalaxyelabs/stonescriptphp-auth-client';
 *
 * providers: [
 *   provideNgxStoneScriptPhpClient(environment, new ProgalaxyElabsAuth({ host: '...', platformCode: '...' }))
 * ]
 * ```
 */
export function provideNgxStoneScriptPhpClient(
    environment: MyEnvironmentModel,
    plugin?: AuthPlugin
): EnvironmentProviders {
    const resolvedPlugin = plugin ?? new StoneScriptPHPAuth({
        // Resolve auth host: auth.host → apiServer.host
        host: environment.auth?.host || environment.apiServer.host,
        platformCode: environment.platformCode,
        authServers: environment.authServers,
        responseMap: environment.auth?.responseMap,
        auth: environment.auth
    });

    return makeEnvironmentProviders([
        { provide: MyEnvironmentModel, useValue: environment },
        { provide: AUTH_PLUGIN, useValue: resolvedPlugin }
    ]);
}
