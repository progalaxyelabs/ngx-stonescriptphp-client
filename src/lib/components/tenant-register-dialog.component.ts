import { Component, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantRegisterComponent, TenantCreatedEvent } from './tenant-register.component';
import { AuthProvider } from '../../auth.service';

/**
 * Dialog wrapper for TenantRegisterComponent
 *
 * Usage with Angular Material Dialog:
 * ```typescript
 * const dialogRef = this.dialog.open(TenantRegisterDialogComponent, {
 *   width: '500px',
 *   data: {
 *     providers: ['google'],
 *     tenantNameLabel: 'Store Name'
 *   }
 * });
 *
 * dialogRef.afterClosed().subscribe(result => {
 *   if (result && result.tenant) {
 *     console.log('Tenant created:', result.tenant);
 *   }
 * });
 * ```
 *
 * Usage with custom dialog service:
 * ```typescript
 * const dialog = this.dialogService.open(TenantRegisterDialogComponent, {
 *   providers: ['google', 'emailPassword']
 * });
 * ```
 */
@Component({
    selector: 'lib-tenant-register-dialog',
    standalone: true,
    imports: [CommonModule, TenantRegisterComponent],
    template: `
        <div class="dialog-wrapper">
            <lib-tenant-register
                [title]="data?.title || 'Create New Organization'"
                [providers]="data?.providers || ['google']"
                [requireTenantName]="data?.requireTenantName !== false"
                [tenantSectionTitle]="data?.tenantSectionTitle || 'Organization Information'"
                [tenantNameLabel]="data?.tenantNameLabel || 'Organization Name'"
                [tenantNamePlaceholder]="data?.tenantNamePlaceholder || 'Enter your organization name'"
                [tenantSlugLabel]="data?.tenantSlugLabel || 'Organization URL'"
                [tenantSlugPlaceholder]="data?.tenantSlugPlaceholder || 'organization-name'"
                [urlPreviewEnabled]="data?.urlPreviewEnabled !== false"
                [urlPreviewPrefix]="data?.urlPreviewPrefix || 'app.example.com/'"
                [userSectionTitle]="data?.userSectionTitle || 'Your Information'"
                [oauthDescription]="data?.oauthDescription || 'Recommended: Sign up with your Google account'"
                [ownershipTitle]="data?.ownershipTitle || 'CREATING A NEW ORGANIZATION'"
                [ownershipMessage]="data?.ownershipMessage || 'You are registering as an organization owner. If you are an employee, use Login instead.'"
                [submitButtonText]="data?.submitButtonText || 'Create Organization'"
                [loginLinkText]="data?.loginLinkText || 'Already have an account?'"
                [loginLinkAction]="data?.loginLinkAction || 'Sign in'"
                (tenantCreated)="onTenantCreated($event)"
                (navigateToLogin)="onNavigateToLogin()">
            </lib-tenant-register>
        </div>
    `,
    styles: [`
        .dialog-wrapper {
            padding: 0;
        }
    `]
})
export class TenantRegisterDialogComponent {
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

    onTenantCreated(event: TenantCreatedEvent) {
        // Close dialog and return the created tenant
        if (this.dialogRef && this.dialogRef.close) {
            this.dialogRef.close(event);
        }
    }

    onNavigateToLogin() {
        // Close dialog without result (user wants to login instead)
        if (this.dialogRef && this.dialogRef.close) {
            this.dialogRef.close({ action: 'navigate_to_login' });
        }
    }
}
