import { Component, Input, Output, EventEmitter, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Membership } from '../../models/auth.models';

export type TenantSwitcherState = 'idle' | 'loading' | 'error';

export interface TenantSwitcherError {
  message: string;
  code?: string;
}

/**
 * Compact dropdown component for switching between tenant memberships.
 * Designed for use in headers/navbars.
 */
@Component({
  selector: 'ngx-ssp-tenant-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tenant-switcher.component.html',
  styleUrls: ['./tenant-switcher.component.scss']
})
export class TenantSwitcherComponent implements OnInit {
  /**
   * Array of tenant memberships to choose from
   */
  @Input() memberships: Membership[] = [];

  /**
   * Optional branding data for displaying tenant logos
   * Map of tenant_id to logo URL
   */
  @Input() tenantBranding?: Map<number, { name?: string; logo?: string }>;

  /**
   * Platform code for constructing login URLs
   */
  @Input() platformCode: string = '';

  /**
   * Emitted when a tenant is successfully switched
   */
  @Output() tenantSwitched = new EventEmitter<Membership>();

  /**
   * Emitted when tenant switching fails
   */
  @Output() switchError = new EventEmitter<TenantSwitcherError>();

  state: TenantSwitcherState = 'idle';
  error: TenantSwitcherError | null = null;
  isDropdownOpen: boolean = false;
  currentMembership: Membership | null = null;

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Get current membership from AuthService
    this.currentMembership = this.authService.getCurrentMembership();

    // Subscribe to membership changes
    this.authService.membership$.subscribe(membership => {
      this.currentMembership = membership;
    });

    if (!this.memberships || this.memberships.length === 0) {
      console.warn('TenantSwitcherComponent: memberships array is empty');
    }
  }

  /**
   * Close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen = false;
    }
  }

  /**
   * Toggle dropdown open/close
   */
  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  /**
   * Close dropdown
   */
  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  /**
   * Handle tenant switch
   */
  onSwitchTenant(membership: Membership, event: Event): void {
    event.stopPropagation();

    // Don't switch if already on this tenant
    if (this.isCurrentTenant(membership)) {
      this.closeDropdown();
      return;
    }

    this.state = 'loading';
    this.error = null;

    // Call AuthService to switch tenant
    this.authService.switchTenant(membership.tenant_id).subscribe({
      next: (response) => {
        this.state = 'idle';
        this.currentMembership = membership;
        this.closeDropdown();
        this.tenantSwitched.emit(membership);

        // Reload the page to refresh the application context
        window.location.reload();
      },
      error: (err) => this.handleSwitchError(err)
    });
  }

  /**
   * Open tenant in new tab
   */
  openInNewTab(membership: Membership, event: Event): void {
    event.stopPropagation();

    // Construct URL: /login with tenant context
    const tenantSlug = this.getTenantSlug(membership);
    const url = `/login/${tenantSlug}`;

    window.open(url, '_blank');
  }

  /**
   * Get tenant slug (fallback to tenant_id if not available)
   */
  getTenantSlug(membership: Membership): string {
    // For now, use tenant_id as slug
    // In a real implementation, this might come from branding data
    return `${membership.tenant_id}`;
  }

  /**
   * Get display name for a tenant
   */
  getTenantName(membership: Membership): string {
    // Try to get name from branding data
    if (this.tenantBranding) {
      const branding = this.tenantBranding.get(membership.tenant_id);
      if (branding?.name) {
        return branding.name;
      }
    }

    // Fallback to tenant ID
    return `Tenant #${membership.tenant_id}`;
  }

  /**
   * Get current tenant name
   */
  getCurrentTenantName(): string {
    if (this.currentMembership) {
      return this.getTenantName(this.currentMembership);
    }
    return 'Select Tenant';
  }

  /**
   * Get logo URL for a tenant
   */
  getTenantLogo(membership: Membership): string | null {
    if (this.tenantBranding) {
      const branding = this.tenantBranding.get(membership.tenant_id);
      return branding?.logo || null;
    }
    return null;
  }

  /**
   * Get current tenant logo
   */
  getCurrentTenantLogo(): string | null {
    if (this.currentMembership) {
      return this.getTenantLogo(this.currentMembership);
    }
    return null;
  }

  /**
   * Get tenant initial for logo placeholder
   */
  getTenantInitial(membership: Membership): string {
    return this.getTenantName(membership).charAt(0).toUpperCase();
  }

  /**
   * Get user-friendly role label
   */
  getRoleLabel(role: string): string {
    const roleMap: { [key: string]: string } = {
      'owner': 'Owner',
      'admin': 'Admin',
      'staff': 'Staff',
      'member': 'Member',
      'viewer': 'Viewer'
    };

    return roleMap[role.toLowerCase()] || role;
  }

  /**
   * Get CSS class for role badge
   */
  getRoleBadgeClass(role: string): string {
    const roleClass = role.toLowerCase();
    return `role-badge role-${roleClass}`;
  }

  /**
   * Check if a tenant is the current tenant
   */
  isCurrentTenant(membership: Membership): boolean {
    return this.currentMembership?.tenant_id === membership.tenant_id;
  }

  /**
   * Handle tenant switch errors
   */
  private handleSwitchError(err: any): void {
    this.state = 'error';

    let errorMessage = 'Failed to switch tenant. Please try again.';
    let errorCode = 'SWITCH_FAILED';

    if (err.error) {
      if (typeof err.error === 'string') {
        errorMessage = err.error;
      } else if (err.error.message) {
        errorMessage = err.error.message;
      } else if (err.error.error) {
        errorMessage = err.error.error;
      }

      if (err.error.code) {
        errorCode = err.error.code;
      }
    } else if (err.status === 401) {
      errorMessage = 'Session expired. Please login again.';
      errorCode = 'INVALID_TOKEN';
    } else if (err.status === 403) {
      errorMessage = 'Access denied to this tenant.';
      errorCode = 'ACCESS_DENIED';
    } else if (err.status === 0) {
      errorMessage = 'Cannot connect to server. Please check your internet connection.';
      errorCode = 'NETWORK_ERROR';
    } else if (err.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
      errorCode = 'SERVER_ERROR';
    }

    const switchError: TenantSwitcherError = {
      message: errorMessage,
      code: errorCode
    };

    this.error = switchError;
    this.switchError.emit(switchError);
    this.closeDropdown();
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error = null;
    if (this.state === 'error') {
      this.state = 'idle';
    }
  }

  /**
   * Check if the component is in a loading state
   */
  get isLoading(): boolean {
    return this.state === 'loading';
  }

  /**
   * Check if the component has an error
   */
  get hasError(): boolean {
    return this.state === 'error' && this.error !== null;
  }

  /**
   * Get sorted memberships (active first, then by role priority)
   */
  get sortedMemberships(): Membership[] {
    const rolePriority: { [key: string]: number } = {
      'owner': 1,
      'admin': 2,
      'staff': 3,
      'member': 4,
      'viewer': 5
    };

    return [...this.memberships].sort((a, b) => {
      // Current tenant first
      if (this.isCurrentTenant(a) && !this.isCurrentTenant(b)) return -1;
      if (!this.isCurrentTenant(a) && this.isCurrentTenant(b)) return 1;

      // Active status second
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;

      // Then by role priority
      const aPriority = rolePriority[a.role.toLowerCase()] || 999;
      const bPriority = rolePriority[b.role.toLowerCase()] || 999;

      return aPriority - bPriority;
    });
  }

  /**
   * Get filtered memberships (same platform as current)
   */
  get filteredMemberships(): Membership[] {
    // For now, return all sorted memberships
    // In a real implementation, you might filter by platform
    return this.sortedMemberships;
  }
}
