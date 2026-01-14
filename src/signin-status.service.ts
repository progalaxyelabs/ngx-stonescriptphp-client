import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SigninStatusService {
    public status: BehaviorSubject<boolean>

    constructor() {
        this.status = new BehaviorSubject<boolean>(false)
    }

    signedOut(): void {
        this.status.next(false)
    }

    signedIn(): void {
        this.status.next(true)
    }

    /**
     * Set signin status
     * @param isSignedIn - True if user is signed in, false otherwise
     */
    setSigninStatus(isSignedIn: boolean): void {
        this.status.next(isSignedIn)
    }
}
