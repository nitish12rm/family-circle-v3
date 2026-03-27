/**
 * NotificationTransport — plug-and-play interface.
 *
 * Current: FCMTransport (Firebase Cloud Messaging foreground messages).
 *          Falls back to PollingTransport if FCM is unavailable / permission denied.
 * Future:  WebSocketTransport, etc. — just implement this interface and swap in the store.
 */
export interface NotificationTransport {
  start(onUpdate: () => void): void;
  stop(): void;
}

// ── Polling (fallback / development) ─────────────────────────────────────────

export class PollingTransport implements NotificationTransport {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;

  constructor(intervalMs = 15_000) {
    this.intervalMs = intervalMs;
  }

  start(onUpdate: () => void) {
    this.stop();
    this.timer = setInterval(onUpdate, this.intervalMs);
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ── FCM (production) ──────────────────────────────────────────────────────────

/**
 * FCMTransport listens for foreground Firebase messages and triggers a
 * store refresh on each one.
 *
 * Setup is async — if FCM is unavailable (no permission, unsupported browser,
 * missing config) it transparently falls back to PollingTransport.
 *
 * Swap in the store with one line:
 *   const transport = new FCMTransport();
 */
export class FCMTransport implements NotificationTransport {
  private unsubscribe: (() => void) | null = null;
  private fallback: PollingTransport | null = null;

  start(onUpdate: () => void) {
    this._setup(onUpdate).catch(() => {
      // FCM unavailable — use polling as silent fallback
      this.fallback = new PollingTransport(15_000);
      this.fallback.start(onUpdate);
    });
  }

  private async _setup(onUpdate: () => void) {
    const { getFirebaseMessaging } = await import("@/lib/firebase");
    const { onMessage } = await import("firebase/messaging");
    const messaging = await getFirebaseMessaging();
    if (!messaging) throw new Error("FCM not supported");
    this.unsubscribe = onMessage(messaging, () => onUpdate());
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.fallback?.stop();
    this.fallback = null;
  }
}

// ── WebSocket stub (future reference) ────────────────────────────────────────
//
// export class WebSocketTransport implements NotificationTransport {
//   private ws: WebSocket | null = null;
//   start(onUpdate: () => void) {
//     this.ws = new WebSocket(WS_URL);
//     this.ws.onmessage = () => onUpdate();
//   }
//   stop() { this.ws?.close(); }
// }
