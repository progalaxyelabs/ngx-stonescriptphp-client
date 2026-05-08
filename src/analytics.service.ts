import { Injectable, Inject } from '@angular/core';
import { MyEnvironmentModel } from '@progalaxyelabs/stonescriptphp-client-core';

/**
 * Privacy-respecting analytics service for StoneScriptPHP platforms.
 *
 * Sends fire-and-forget event tracking calls to POST /portal/analytics/track.
 * No third-party services — events go directly to the platform's own backend.
 *
 * Features:
 * - Session ID (UUID v4) stored in sessionStorage — resets on tab close
 * - `keepalive: true` ensures delivery even when the user navigates away
 * - All errors are silently discarded — never blocks the UI
 * - No auth token required — the backend endpoint is public
 *
 * Usage:
 * ```typescript
 * constructor(private analytics: AnalyticsService) {}
 *
 * ngOnInit() {
 *     this.analytics.track('page_view', { page: 'dashboard' });
 * }
 * ```
 */
@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {

    private readonly host: string;
    private sessionId: string | null = null;

    private static readonly SESSION_KEY = 'ssphp_session_id';
    private static readonly ENDPOINT = '/portal/analytics/track';

    constructor(@Inject(MyEnvironmentModel) environment: MyEnvironmentModel) {
        this.host = environment.apiServer.host.replace(/\/$/, '');
    }

    /**
     * Track an analytics event. Fire-and-forget — never throws.
     *
     * @param event  Event name (e.g. 'page_view', 'item_created', 'checkout_started')
     * @param data   Optional key-value payload attached to the event
     */
    track(event: string, data?: Record<string, any>): void {
        const payload = {
            event,
            data: data ?? {},
            session_id: this.getOrCreateSessionId(),
            timestamp: new Date().toISOString(),
        };

        fetch(`${this.host}${AnalyticsService.ENDPOINT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true, // ensures delivery even on page unload
        }).catch(() => {
            // Silently discard — analytics must never break the app
        });
    }

    /**
     * Returns the current session ID, creating and persisting one if absent.
     * Uses sessionStorage so the ID resets when the browser tab is closed.
     */
    private getOrCreateSessionId(): string {
        if (!this.sessionId) {
            try {
                const stored = sessionStorage.getItem(AnalyticsService.SESSION_KEY);
                this.sessionId = stored ?? this.generateUuid();
                sessionStorage.setItem(AnalyticsService.SESSION_KEY, this.sessionId);
            } catch {
                // sessionStorage unavailable (e.g. private mode restrictions)
                this.sessionId = this.generateUuid();
            }
        }
        return this.sessionId;
    }

    /**
     * Generate a UUID v4 string without external dependencies.
     */
    private generateUuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
}
