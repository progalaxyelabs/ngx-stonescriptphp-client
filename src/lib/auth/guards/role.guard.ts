import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // Get allowed roles from route data
    const allowedRoles: string[] = route.data['roles'] || [];

    if (allowedRoles.length === 0) {
      // No roles specified, allow access
      return true;
    }

    // Get current membership
    const membership = this.authService.getCurrentMembership();

    if (!membership) {
      // No membership, redirect to login
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url }
      });
    }

    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(membership.role)) {
      return true;
    }

    // User does not have required role, redirect to unauthorized
    return this.router.createUrlTree(['/unauthorized']);
  }
}
