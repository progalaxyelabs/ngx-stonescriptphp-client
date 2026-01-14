import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      return true;
    }

    // Try to refresh the token if expired
    return this.authService.refreshToken().pipe(
      map(() => {
        // After refresh, check authentication again
        if (this.authService.isAuthenticated()) {
          return true;
        }
        // Still not authenticated, redirect to login
        return this.router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }),
      catchError(() => {
        // Refresh failed, redirect to login
        return of(this.router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        }));
      })
    );
  }
}
