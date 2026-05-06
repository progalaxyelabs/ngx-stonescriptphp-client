import { InjectionToken } from '@angular/core';

/**
 * Notification handler interface for displaying messages to users.
 *
 * Inject NOTIFICATION_HANDLER to provide a custom implementation,
 * or let the library use console logging as a fallback.
 */
export interface NotificationHandler {
    error(message: string): void;
    success(message: string): void;
    warn(message: string): void;
}

/**
 * Injection token for the notification handler.
 *
 * Provide your own implementation to display snackbar, toast, or other UI notifications.
 *
 * @example
 * ```typescript
 * import { NOTIFICATION_HANDLER, NotificationHandler } from '@progalaxyelabs/ngx-stonescriptphp-client';
 * import { MatSnackBar } from '@angular/material/snack-bar';
 *
 * @Injectable()
 * export class SnackBarNotificationHandler implements NotificationHandler {
 *   constructor(private snackBar: MatSnackBar) {}
 *
 *   error(message: string) {
 *     this.snackBar.open(message, 'Close', { panelClass: 'error-snackbar' });
 *   }
 *   success(message: string) {
 *     this.snackBar.open(message, 'Close', { duration: 3000 });
 *   }
 *   warn(message: string) {
 *     this.snackBar.open(message, 'Close', { panelClass: 'warn-snackbar' });
 *   }
 * }
 *
 * // In app.config.ts:
 * providers: [
 *   { provide: NOTIFICATION_HANDLER, useClass: SnackBarNotificationHandler }
 * ]
 * ```
 */
export const NOTIFICATION_HANDLER = new InjectionToken<NotificationHandler>('NOTIFICATION_HANDLER');
