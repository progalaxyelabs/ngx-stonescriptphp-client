import { Injectable, Optional, Inject } from '@angular/core';
import { LogService as CoreLogService, MyEnvironmentModel } from '@progalaxyelabs/stonescriptphp-client-core';

/**
 * Angular wrapper for LogService.
 *
 * Automatically picks up the debug flag from MyEnvironmentModel if provided.
 */
@Injectable({
    providedIn: 'root'
})
export class LogService extends CoreLogService {
    constructor(@Optional() @Inject(MyEnvironmentModel) env: MyEnvironmentModel | null) {
        super(env?.debug ?? false);
    }
}
