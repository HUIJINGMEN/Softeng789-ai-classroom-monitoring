import type { FrameResult } from './cameraSession';
import { matrixPose, poseDifference, type Pose } from './observationModel';

// Experimental observation thresholds, NOT validated sleep/fatigue/attention cutoffs.
export const LOCAL_LIMITS = { calibrationMs: 2000, minCalibrationSamples: 8, gapMs: 750, eyesMs: 2000, headMs: 3000, headDegrees: 15, history: 20 };
export type LocalKind = 'EYES_CLOSED' | 'HEAD_LOWERED';
export type LocalEvent = { kind: LocalKind; at: number; durationMs: number };
export type Reading = { status: 'unavailable' | 'clear' | 'pending' | 'sustained'; durationMs: number; reason: string };
export type LocalView = { calibrated: boolean; calibrating: boolean; progress: number; message: string; eyes: Reading; head: Reading; events: LocalEvent[] };
const unavailable = (reason: string): Reading => ({ status: 'unavailable', durationMs: 0, reason });
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

class Dwell {
  private since: number | null = null;
  private emitted = false;
  reset() { this.since = null; this.emitted = false; }
  update(condition: boolean | null, at: number, threshold: number, reason: string): { reading: Reading; event: boolean } {
    if (condition !== true) {
      this.reset();
      return { reading: condition === null ? unavailable(reason) : { status: 'clear', durationMs: 0, reason }, event: false };
    }
    if (this.since === null) this.since = at;
    const durationMs = at - this.since;
    const event = durationMs >= threshold && !this.emitted;
    if (event) this.emitted = true;
    return { reading: { status: durationMs >= threshold ? 'sustained' : 'pending', durationMs, reason }, event };
  }
}

/** Page-memory-only state machine. No shared Observation type or API dependency. */
export class EyeHeadObserver {
  private baseline: { left: number; right: number; pose: Pose } | null = null;
  private samples: { at: number; left: number; right: number; pose: Pose }[] = [];
  private last = -1;
  private calibrating = false;
  private eyes = new Dwell();
  private head = new Dwell();
  private events: LocalEvent[] = [];
  private view: LocalView = this.snapshot('Enable the local test and calibrate first.');
  private snapshot(message: string): LocalView {
    return { calibrated: !!this.baseline, calibrating: this.calibrating, progress: 0, message,
      eyes: unavailable(message), head: unavailable(message), events: [...this.events] };
  }
  current() { return this.view; }
  clearHistory() { this.events = []; this.view = { ...this.view, events: [] }; return this.view; }
  calibrate() {
    this.baseline = null; this.samples = []; this.events = []; this.last = -1;
    this.calibrating = true; this.eyes.reset(); this.head.reset();
    return this.view = this.snapshot('Keep both eyes open and face forward for 2 seconds.');
  }
  pause(reason = 'Analysis unavailable; continuous durations reset.') {
    this.eyes.reset(); this.head.reset(); this.samples = []; this.last = -1;
    return this.view = this.snapshot(reason);
  }
  update(frame: FrameResult): LocalView {
    const at = frame.timestamp;
    if (!Number.isFinite(at) || at <= this.last) return this.pause('Invalid or out-of-order sample; durations reset.');
    if (this.last >= 0 && at - this.last > LOCAL_LIMITS.gapMs) this.pause('Sampling gap; durations reset.');
    this.last = at;
    const pose = frame.count === 1 ? matrixPose(frame.matrix) : null;
    const evidence = frame.localEyes;
    const reason = frame.count !== 1 ? 'Exactly one visible face is required.' : !pose ? 'Head direction unavailable.'
      : !evidence ? 'Eye/lighting measurements unavailable.' : evidence.reason;
    const validEyes = evidence && evidence.left !== null && evidence.right !== null
      && Number.isFinite(evidence.left) && Number.isFinite(evidence.right)
      && evidence.left >= 0 && evidence.right >= 0 && evidence.left <= .65 && evidence.right <= .65;
    if (reason || !pose || !validEyes || !evidence) return this.pause(reason || 'Eye geometry unavailable.');
    if (Math.abs(pose.yaw) > 35 || Math.abs(pose.roll) > 25 || Math.abs(pose.pitch) > 60) return this.pause('Face angle too large; face the camera more directly.');
    const left = evidence.left!, right = evidence.right!;
    if (this.calibrating) {
      // Conservative open-eye and stable-pose gate. Some users will need different
      // thresholds after validation; do not guess a baseline from closed eyes.
      const first = this.samples[0];
      const delta = first ? poseDifference(pose, first.pose) : { yaw: 0, pitch: 0, roll: 0 };
      if (Math.abs(pose.yaw) > 15 || Math.abs(pose.pitch) > 20 || Math.abs(pose.roll) > 15
        || left < .18 || right < .18 || left > .5 || right > .5
        || Math.max(Math.abs(delta.yaw), Math.abs(delta.pitch), Math.abs(delta.roll)) > 5
        || (first && (Math.abs(left / first.left - 1) > .2 || Math.abs(right / first.right - 1) > .2))) {
        this.samples = [];
        return this.view = this.snapshot('Calibration restarted: keep both eyes naturally open, face forward and hold still.');
      }
      this.samples.push({ at, left, right, pose });
      if (this.samples.length > 100) return this.pause('Calibration sampling limit reached; try again.');
      const elapsed = at - this.samples[0].at;
      if (elapsed >= LOCAL_LIMITS.calibrationMs && this.samples.length >= LOCAL_LIMITS.minCalibrationSamples) {
        this.baseline = { left: median(this.samples.map(s => s.left)), right: median(this.samples.map(s => s.right)),
          pose: { yaw: median(this.samples.map(s => s.pose.yaw)), pitch: median(this.samples.map(s => s.pose.pitch)), roll: median(this.samples.map(s => s.pose.roll)) } };
        this.calibrating = false; this.samples = [];
        return this.view = this.snapshot('Reference ready. Recalibrate if you or the camera change position.');
      }
      return this.view = { ...this.snapshot('Keep both eyes open and face forward for 2 seconds.'), progress: Math.min(99, Math.round(elapsed / LOCAL_LIMITS.calibrationMs * 100)) };
    }
    if (!this.baseline) return this.view = this.snapshot('Calibrate your open eyes and forward head position first.');
    const delta = poseDifference(pose, this.baseline.pose);
    const eyeAngleOK = Math.abs(delta.yaw) <= 20 && Math.abs(delta.pitch) <= 20 && Math.abs(delta.roll) <= 15;
    const l = left / this.baseline.left, r = right / this.baseline.right;
    const eyesClosed = !eyeAngleOK ? null : l <= .5 && r <= .5 ? true : l >= .75 && r >= .75 ? false : null;
    const eyeReading = this.eyes.update(eyesClosed, at, LOCAL_LIMITS.eyesMs,
      !eyeAngleOK ? 'Eye angle unsuitable for measurement.' : eyesClosed === null ? 'Eye state uncertain or asymmetric.' : eyesClosed ? 'Both eyes appear closed.' : 'Both eyes appear open.');
    // Canonical face coordinates are Y-up: positive X rotation/pitch lowers the nose.
    // Require downward pitch, never absolute pitch (looking up is not head lowering).
    const headLowered = Math.abs(delta.yaw) > 25 || Math.abs(delta.roll) > 20 ? null : delta.pitch >= LOCAL_LIMITS.headDegrees;
    const headReading = this.head.update(headLowered, at, LOCAL_LIMITS.headMs,
      headLowered === null ? 'Head angle unsuitable for measurement.' : headLowered ? 'Head below the calibrated forward position.' : 'Head is not lowered from the reference.');
    for (const [kind, result] of [['EYES_CLOSED', eyeReading], ['HEAD_LOWERED', headReading]] as const) {
      if (result.event) this.events = [{ kind, at, durationMs: result.reading.durationMs }, ...this.events].slice(0, LOCAL_LIMITS.history);
    }
    return this.view = { calibrated: true, calibrating: false, progress: 100, message: 'Local measurements only; no sleep or attention judgement.', eyes: eyeReading.reading, head: headReading.reading, events: [...this.events] };
  }
}
