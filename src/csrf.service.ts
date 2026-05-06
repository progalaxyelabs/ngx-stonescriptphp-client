import { Injectable } from '@angular/core';
import { CsrfService as CoreCsrfService } from '@progalaxyelabs/stonescriptphp-client-core';

/**
 * Angular wrapper for CsrfService.
 *
 * Provides the same API as the core CsrfService but as an Angular @Injectable.
 */
@Injectable({
    providedIn: 'root'
})
export class CsrfService extends CoreCsrfService {
    constructor() {
        super();
    }
}
