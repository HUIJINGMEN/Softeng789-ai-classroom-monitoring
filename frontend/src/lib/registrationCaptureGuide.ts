import type { FaceEnrollmentPose } from '../types';
import { matrixPose, type Pose } from '../features/webcam-events/observationModel';
import type { FrameResult } from '../features/webcam-events/cameraSession';

export type GuideSample = { ready: boolean; message: string; pose: Pose | null };

/** Local framing/pose guidance only. The server still decides whether a photo is accepted. */
export function registrationGuideSample(frame: FrameResult, target: FaceEnrollmentPose, aspect: number, frontPitch: number | null): GuideSample {
  const pose = matrixPose(frame.matrix);
  const reject = (message: string): GuideSample => ({ ready: false, message, pose });
  if (frame.count !== 1) return reject(frame.count ? 'Only one person should be in the frame.' : 'Place your face inside the outline.');
  const box = frame.boxes[0];
  if (!box || !Object.values(box).every(Number.isFinite) || !Number.isFinite(aspect) || aspect <= 0) return reject('Keep your whole face visible.');
  if (Math.abs(box.x + box.width / 2 - .5) > .08 || Math.abs(box.y + box.height / 2 - .5) > .08) return reject('Move your face to the centre of the outline.');
  // The oval is 72% of the frame height, with width 75% of its height.
  if (box.height < .43 || box.width * aspect < .24) return reject('Move a little closer.');
  if (box.height > .72 || box.width * aspect > .54) return reject('Move a little farther away.');
  if (!pose) return reject('Face direction is unavailable. Try manual capture.');
  if (Math.abs(pose.roll) > 12) return reject('Keep your head upright without tilting sideways.');
  const pitch = pose.pitch - (frontPitch ?? 0);
  const yaw = pose.yaw;
  // Unmirrored MediaPipe input: positive yaw turns toward the person's own left.
  let matches = false;
  switch (target) {
    case 'front': matches = Math.abs(yaw) <= 8 && Math.abs(pitch) <= (frontPitch === null ? 22 : 10); break;
    case 'slight_left': matches = yaw >= 12 && yaw <= 23 && Math.abs(pitch) <= 12; break;
    case 'left': matches = yaw >= 25 && yaw <= 38 && Math.abs(pitch) <= 12; break;
    case 'slight_right': matches = yaw <= -12 && yaw >= -23 && Math.abs(pitch) <= 12; break;
    case 'right': matches = yaw <= -25 && yaw >= -38 && Math.abs(pitch) <= 12; break;
    case 'chin_up': matches = pitch <= -10 && pitch >= -24 && Math.abs(yaw) <= 10; break;
    case 'chin_down': matches = pitch >= 10 && pitch <= 24 && Math.abs(yaw) <= 10; break;
  }
  return { ready: matches, pose, message: matches ? 'Good position. Hold still…' : 'Follow the direction shown, then hold still.' };
}

/** Require fresh consecutive samples and a steady head; gaps never count as holding. */
export class RegistrationCaptureHold {
  private since = 0;
  private last = -1;
  private anchor: Pose | null = null;
  reset() { this.since = 0; this.last = -1; this.anchor = null; }
  update(sample: GuideSample, at: number) {
    if (!sample.ready || !sample.pose || !Number.isFinite(at) || at <= this.last) { this.reset(); return 0; }
    const moved = this.anchor && (Math.abs(sample.pose.yaw - this.anchor.yaw) > 4 || Math.abs(sample.pose.pitch - this.anchor.pitch) > 4 || Math.abs(sample.pose.roll - this.anchor.roll) > 4);
    if (this.last < 0 || at - this.last > 500 || moved) { this.since = at; this.anchor = sample.pose; }
    this.last = at;
    return Math.min(1, (at - this.since) / 1000);
  }
}
