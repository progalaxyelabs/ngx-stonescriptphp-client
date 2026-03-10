import { Injectable, Optional } from '@angular/core';
import { MyEnvironmentModel } from './my-environment.model';

/**
 * LogService — debug logger for ProgalaxyELabs Angular platforms.
 *
 * Reads environment.debug from MyEnvironmentModel (set via provideNgxStoneScriptPhpClient).
 * All output is silenced when debug = false (production default).
 *
 * Usage in components / services:
 * ```typescript
 * constructor(private log: LogService) {}
 *
 * this.log.debug('MyComponent', 'event fired', { data });
 * ```
 *
 * Configure in app:
 * ```typescript
 * // environment.ts
 * export const environment = { production: false, debug: true, ... };
 *
 * // app.config.ts
 * provideNgxStoneScriptPhpClient(environment)  // LogService picks up environment.debug automatically
 * ```
 */
@Injectable({ providedIn: 'root' })
export class LogService {
    private _debug = false;

    constructor(@Optional() env: MyEnvironmentModel) {
        this._debug = env?.debug ?? false;
    }

    /** Log a debug message. No-op when environment.debug = false. */
    debug(context: string, message: string, ...args: any[]): void {
        if (this._debug) {
            console.log(`[DEBUG][${context}] ${message}`, ...args);
        }
    }

    /** Log a warning. Always visible regardless of debug flag. */
    warn(context: string, message: string, ...args: any[]): void {
        console.warn(`[WARN][${context}] ${message}`, ...args);
    }

    /** Log an error. Always visible regardless of debug flag. */
    error(context: string, message: string, ...args: any[]): void {
        console.error(`[ERROR][${context}] ${message}`, ...args);
    }

    /** Returns true if debug mode is on (useful for conditional expensive logging). */
    get isDebug(): boolean {
        return this._debug;
    }
}
