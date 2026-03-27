/**
 * NotificationTransport — plug-and-play interface.
 *
 * Today: PollingTransport (HTTP poll every N seconds).
 * Future: swap in FCMTransport, WebSocketTransport, etc.
 * The store only depends on this interface — zero other changes needed.
 */
export interface NotificationTransport {
  start(onUpdate: () => void): void;
  stop(): void;
}

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

// ── Future transports (stubs for reference) ──────────────────────────────────
//
// export class FCMTransport implements NotificationTransport {
//   start(onUpdate: () => void) {
//     messaging().onMessage(() => onUpdate());
//   }
//   stop() { /* unsubscribe */ }
// }
//
// export class WebSocketTransport implements NotificationTransport {
//   private ws: WebSocket | null = null;
//   start(onUpdate: () => void) {
//     this.ws = new WebSocket(WS_URL);
//     this.ws.onmessage = () => onUpdate();
//   }
//   stop() { this.ws?.close(); }
// }
