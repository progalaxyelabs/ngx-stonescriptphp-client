import { Component, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantLoginComponent, TenantSelectedEvent } from './tenant-login.component';
import { AuthProvider } from '../../auth.service';

/**
 * Dialog wrapper for TenantLoginComponent
 *
 * Usage with Angular Material Dialog:
 * ```typescript
 * const dialogRef = this.dialog.open(TenantLoginDialogComponent, {
 *   width: '450px',
 *   data: {
 *     providers: ['google'],
 *     showTenantSelector: true
 *   }
 * });
 *
 * dialogRef.afterClosed().subscribe(result => {
 *   if (result && result.tenantId) {
 *     console.log('Logged in to tenant:', result.tenantSlug);
 *     // Redirect to dashboard
 *   }
 * });
 * ```
 *
 * Usage with custom dialog service:
 * ```typescript
 * const dialog = this.dialogService.open(TenantLoginDialogComponent, {
 *   providers: ['google', 'emailPassword'],
 *   autoSelectSingleTenant: true
 * });
 * ```
 */
@Component({
    selector: 'lib-tenant-login-dialog',
    standalone: true,
    imports: [CommonModule, TenantLoginComponent],
    template: `
        <div class="dialog-wrapper">
            <lib-tenant-login
                [title]="data?.title || 'Sign In'"
                [providers]="data?.providers || ['google']"
                [showTenantSelector]="data?.showTenantSelector !== false"
                [autoSelectSingleTenant]="data?.autoSelectSingleTenant !== false"
                [allowTenantCreation]="data?.allowTenantCreation !== false"
                [tenantSelectorTitle]="data?.tenantSelectorTitle || 'Select Organization'"
                [tenantSelectorDescription]="data?.tenantSelectorDescription || 'Choose which organization you want to access:'"
                [continueButtonText]="data?.continueButtonText || 'Continue'"
                [registerLinkText]="data?.registerLinkText || 'Don\\'t have an account?'"
                [registerLinkAction]="data?.registerLinkAction || 'Sign up'"
                [createTenantLinkText]="data?.createTenantLinkText || 'Don\\'t see your organization?'"
                [createTenantLinkAction]="data?.createTenantLinkAction || 'Create New Organization'"
                (tenantSelected)="onTenantSelected($event)"
                (createTenant)="onCreateTenant()">
            </lib-tenant-login>
        </div>
    `,
    styles: [`
        .dialog-wrapper {
            padding: 0;
        }
    `]
})
export class TenantLoginDialogComponent {
    data: any;
    dialogRef: any;

    constructor(
        @Optional() @Inject('DIALOG_DATA') injectedData?: any,
        @Optional() @Inject('DIALOG_REF') injectedDialogRef?: any
    ) {
        // Support both Angular Material Dialog and custom dialog implementations
        this.data = injectedData || {};
        this.dialogRef = injectedDialogRef;
    }

    onTenantSelected(event: TenantSelectedEvent) {
        // Close dialog and return the selected tenant
        if (this.dialogRef && this.dialogRef.close) {
            this.dialogRef.close(event);
        }
    }

    onCreateTenant() {
        // Close dialog and signal that user wants to create a tenant
        if (this.dialogRef && this.dialogRef.close) {
            this.dialogRef.close({ action: 'create_tenant' });
        }
    }
}
