import { Injectable } from '@angular/core';
import { TokenService as CoreTokenService } from '@progalaxyelabs/stonescriptphp-client-core';

/**
 * Angular wrapper for TokenService.
 *
 * Provides the same API as the core TokenService but as an Angular @Injectable.
 * The actual implementation is delegated to the pure TypeScript class.
 */
@Injectable({
    providedIn: 'root'
})
export class TokenService extends CoreTokenService {
    constructor() {
        super();
    }
}
