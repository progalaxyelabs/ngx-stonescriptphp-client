import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Membership } from '../../models/auth.models';

export type TenantPickerState = 'idle' | 'loading' | 'error';

export interface TenantPickerError {
  message: string;
  code?: string;
}

/**
 * Component for selecting a tenant when a user has multiple tenant memberships.
 * Displays available tenants with their roles and handles tenant selection.
 */
@Component({
  selector: 'ngx-ssp-tenant-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-picker.component.html',
  styleUrls: ['./tenant-picker.component.scss']
})
export class TenantPickerComponent implements OnInit {
  /**
   * Array of tenant memberships to choose from
   */
  @Input() memberships: Membership[] = [];

  /**
   * Selection token received from the initial login response
   * Used to complete the tenant selection process
   */
  @Input() selectionToken!: string;

  /**
   * Optional branding data for displaying tenant logos
   * Map of tenant_id to logo URL
   */
  @Input() tenantBranding?: Map<number, { name?: string; logo?: string }>;

  /**
   * Emitted when a tenant is successfully selected
   */
  @Output() tenantSelected = new EventEmitter<Membership>();

  /**
   * Emitted when tenant selection fails
   */
  @Output() selectionError = new EventEmitter<TenantPickerError>();

  state: TenantPickerState = 'idle';
  error: TenantPickerError | null = null;
  rememberChoice: boolean = false;
  selectedTenantId: number | null = null;

  private readonly REMEMBER_CHOICE_KEY = 'auth_remembered_tenant_id';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    if (!this.selectionToken) {
      console.error('TenantPickerComponent: selectionToken is required');
    }

    if (!this.memberships || this.memberships.length === 0) {
      console.error('TenantPickerComponent: memberships array is empty');
    }

    // Check if there's a remembered choice
    const rememberedTenantId = this.getRememberedTenantId();
    if (rememberedTenantId) {
      // Verify the remembered tenant is in the current memberships
      const hasRememberedTenant = this.memberships.some(m => m.tenant_id === rememberedTenantId);
      if (hasRememberedTenant) {
        this.selectedTenantId = rememberedTenantId;
        this.rememberChoice = true;
      } else {
        // Clear invalid remembered choice
        this.clearRememberedChoice();
      }
    }
  }

  /**
   * Handle tenant selection
   */
  onSelectTenant(membership: Membership): void {
    if (!this.selectionToken) {
      this.setError('Selection token is missing');
      return;
    }

    this.state = 'loading';
    this.error = null;
    this.selectedTenantId = membership.tenant_id;

    // Save choice if remember is checked
    if (this.rememberChoice) {
      this.saveRememberedChoice(membership.tenant_id);
    } else {
      this.clearRememberedChoice();
    }

    // Call AuthService to complete tenant selection
    this.authService.selectTenant(this.selectionToken, membership.tenant_id).subscribe({
      next: (response) => {
        this.state = 'idle';
        this.tenantSelected.emit(membership);
      },
      error: (err) => this.handleSelectionError(err)
    });
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
   * Toggle remember choice checkbox
   */
  toggleRememberChoice(): void {
    this.rememberChoice = !this.rememberChoice;
  }

  /**
   * Check if a tenant is currently selected
   */
  isSelected(membership: Membership): boolean {
    return this.selectedTenantId === membership.tenant_id;
  }

  /**
   * Handle tenant selection errors
   */
  private handleSelectionError(err: any): void {
    this.state = 'error';

    let errorMessage = 'Failed to select tenant. Please try again.';
    let errorCode = 'SELECTION_FAILED';

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
      errorMessage = 'Invalid or expired selection token. Please login again.';
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

    const selectionError: TenantPickerError = {
      message: errorMessage,
      code: errorCode
    };

    this.error = selectionError;
    this.selectionError.emit(selectionError);
  }

  /**
   * Set error state
   */
  private setError(message: string, code?: string): void {
    this.state = 'error';
    this.error = {
      message,
      code
    };
    this.selectionError.emit(this.error);
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
   * Save remembered tenant choice to localStorage
   */
  private saveRememberedChoice(tenantId: number): void {
    try {
      localStorage.setItem(this.REMEMBER_CHOICE_KEY, tenantId.toString());
    } catch (e) {
      console.warn('Failed to save remembered tenant choice:', e);
    }
  }

  /**
   * Get remembered tenant ID from localStorage
   */
  private getRememberedTenantId(): number | null {
    try {
      const stored = localStorage.getItem(this.REMEMBER_CHOICE_KEY);
      if (stored) {
        const tenantId = parseInt(stored, 10);
        return isNaN(tenantId) ? null : tenantId;
      }
    } catch (e) {
      console.warn('Failed to retrieve remembered tenant choice:', e);
    }
    return null;
  }

  /**
   * Clear remembered choice from localStorage
   */
  private clearRememberedChoice(): void {
    try {
      localStorage.removeItem(this.REMEMBER_CHOICE_KEY);
    } catch (e) {
      console.warn('Failed to clear remembered tenant choice:', e);
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
      // Active status first
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;

      // Then by role priority
      const aPriority = rolePriority[a.role.toLowerCase()] || 999;
      const bPriority = rolePriority[b.role.toLowerCase()] || 999;

      return aPriority - bPriority;
    });
  }
}
