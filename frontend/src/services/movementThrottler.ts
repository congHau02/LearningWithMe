export interface MovementUpdate {
  x: number;
  y: number;
  facingDir: string;
  isMoving: boolean;
}

export type MovementSendFn = (update: MovementUpdate) => void;

export class MovementThrottler {
  private readonly sendFn: MovementSendFn;
  private readonly intervalMs: number;
  private lastSentTime = 0;
  private pendingUpdate: MovementUpdate | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(sendFn: MovementSendFn, intervalMs = 100) {
    this.sendFn = sendFn;
    this.intervalMs = intervalMs;
  }

  public push(update: MovementUpdate): void {
    if (!update.isMoving) {
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      this.pendingUpdate = null;
      this.lastSentTime = Date.now();
      this.sendFn(update);
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastSentTime;

    if (elapsed >= this.intervalMs && this.timerId === null) {
      this.lastSentTime = now;
      this.sendFn(update);
    } else {
      this.pendingUpdate = update;
      if (this.timerId === null) {
        const remaining = Math.max(0, this.intervalMs - elapsed);
        this.timerId = setTimeout(() => {
          this.timerId = null;
          if (this.pendingUpdate) {
            const queued = this.pendingUpdate;
            this.pendingUpdate = null;
            this.lastSentTime = Date.now();
            this.sendFn(queued);
          }
        }, remaining);
      }
    }
  }

  public flush(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.pendingUpdate) {
      const update = this.pendingUpdate;
      this.pendingUpdate = null;
      this.lastSentTime = Date.now();
      this.sendFn(update);
    }
  }

  public destroy(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.pendingUpdate = null;
  }
}
