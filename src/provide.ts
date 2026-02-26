import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { MyEnvironmentModel } from './my-environment.model';
import { AUTH_PLUGIN, AuthPlugin } from './auth.plugin';
import { StoneScriptPHPAuth } from './plugins/stonescriptphp-auth.plugin';

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
 * import { ProgalaxyElabsAuth } from './progalaxyelabs-auth.auth-plugin';
 *
 * providers: [
 *   provideNgxStoneScriptPhpClient(environment, new ProgalaxyElabsAuth({ host: '...' }))
 * ]
 * ```
 *
 * @example Firebase
 * ```typescript
 * import { FirebaseAuthPlugin } from './firebase-auth.auth-plugin';
 *
 * providers: [
 *   provideNgxStoneScriptPhpClient(environment, new FirebaseAuthPlugin(firebaseConfig))
 * ]
 * ```
 */
export function provideNgxStoneScriptPhpClient(
    environment: MyEnvironmentModel,
    plugin?: AuthPlugin
): EnvironmentProviders {
    const resolvedPlugin = plugin ?? new StoneScriptPHPAuth({
        // Resolve auth host: auth.host → accountsServer.host (compat) → accountsUrl (compat) → apiServer.host
        host: environment.auth?.host
            || environment.accountsServer?.host
            || environment.accountsUrl
            || environment.apiServer.host,
        platformCode: environment.platformCode,
        authServers: environment.authServers,
        responseMap: environment.auth?.responseMap ?? environment.authResponseMap,
        auth: environment.auth,
        apiUrl: environment.apiUrl
    });

    return makeEnvironmentProviders([
        { provide: MyEnvironmentModel, useValue: environment },
        { provide: AUTH_PLUGIN, useValue: resolvedPlugin }
    ]);
}
