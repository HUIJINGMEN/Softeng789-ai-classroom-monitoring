/**
 * Decides when one person has stood in front of the kiosk long enough to send a single capture.
 * It only sees local face-detection boxes (no identity) and never uploads anything itself.
 */
export interface PresenceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PresenceFrame {
  count: number;
  boxes: readonly PresenceBox[];
}

export type PresenceStatus = 'EMPTY' | 'TOO_FAR' | 'MULTIPLE' | 'HOLDING' | 'TRIGGERED' | 'LOCKED' | 'REARMING';

export interface PresenceUpdate {
  status: PresenceStatus;
  /** Share of the dwell time completed, 0 to 1. */
  progress: number;
  /** True exactly once per dwell: take one capture now. */
  trigger: boolean;
}

export interface PresenceConfig {
  dwellMs: number;
  /** Smallest face width as a share of the frame width; smaller faces are too far from the kiosk. */
  minFaceWidth: number;
  /** A longer gap between frames restarts the dwell, so stale frames cannot complete it. */
  maxFrameGapMs: number;
  /** After a result, the camera must see nobody for this long before it captures again ... */
  rearmAbsenceMs: number;
  /** ... or this much time must pass, so a queue of students does not stall the kiosk. */
  rearmTimeoutMs: number;
}

export const PRESENCE_DEFAULTS: PresenceConfig = {
  dwellMs: 2000,
  minFaceWidth: 0.16,
  maxFrameGapMs: 1200,
  rearmAbsenceMs: 1000,
  rearmTimeoutMs: 6000
};

export class PresenceGate {
  private dwellSince: number | null = null;
  private lastAt: number | null = null;
  private locked = false;
  private rearmingSince: number | null = null;
  private absentSince: number | null = null;

  constructor(private readonly config: PresenceConfig = PRESENCE_DEFAULTS) {}

  /** Feed one local detection result with its timestamp (ms). */
  update(frame: PresenceFrame, at: number): PresenceUpdate {
    if (!Number.isFinite(at) || (this.lastAt !== null && at < this.lastAt)) {
      this.dwellSince = null;
      return this.idle(this.locked ? 'LOCKED' : 'EMPTY');
    }
    if (this.lastAt !== null && at - this.lastAt > this.config.maxFrameGapMs) this.dwellSince = null;
    this.lastAt = at;

    if (this.locked) return this.idle('LOCKED');
    if (this.rearmingSince !== null && !this.rearm(frame, at)) return this.idle('REARMING');

    const count = Number.isInteger(frame.count) ? frame.count : 0;
    if (count === 0) return this.restart('EMPTY');
    if (count > 1 || frame.boxes.length > 1) return this.restart('MULTIPLE');
    const box = frame.boxes[0];
    if (!box || !Number.isFinite(box.width) || box.width < this.config.minFaceWidth) return this.restart('TOO_FAR');

    if (this.dwellSince === null) this.dwellSince = at;
    const progress = Math.min(1, (at - this.dwellSince) / this.config.dwellMs);
    if (progress < 1) return { status: 'HOLDING', progress, trigger: false };
    this.locked = true;
    this.dwellSince = null;
    return { status: 'TRIGGERED', progress: 1, trigger: true };
  }

  /** The kiosk is back to scanning after a result: wait for the person to leave before capturing again. */
  release(at: number): void {
    this.locked = false;
    this.dwellSince = null;
    this.absentSince = null;
    this.rearmingSince = Number.isFinite(at) ? at : null;
  }

  /** Fresh start (camera restarted or kiosk opened): no re-arm wait. */
  reset(): void {
    this.locked = false;
    this.dwellSince = null;
    this.lastAt = null;
    this.rearmingSince = null;
    this.absentSince = null;
  }

  private rearm(frame: PresenceFrame, at: number): boolean {
    const since = this.rearmingSince ?? at;
    if (frame.count === 0) {
      if (this.absentSince === null) this.absentSince = at;
    } else {
      this.absentSince = null;
    }
    const absentLongEnough = this.absentSince !== null && at - this.absentSince >= this.config.rearmAbsenceMs;
    if (!absentLongEnough && at - since < this.config.rearmTimeoutMs) return false;
    this.rearmingSince = null;
    this.absentSince = null;
    this.dwellSince = null;
    return true;
  }

  private restart(status: PresenceStatus): PresenceUpdate {
    this.dwellSince = null;
    return this.idle(status);
  }

  private idle(status: PresenceStatus): PresenceUpdate {
    return { status, progress: 0, trigger: false };
  }
}
