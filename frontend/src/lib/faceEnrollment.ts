import type { FaceEnrollmentCapture, FaceEnrollmentPose } from '../types';

export interface FaceEnrollmentStep {
  pose: FaceEnrollmentPose;
  label: string;
  prompt: string;
  instruction: string;
  optional?: boolean;
}

export type FaceEnrollmentProgressState = 'pending' | 'current' | 'done';

export interface FaceEnrollmentProgressDot {
  key: string;
  state: FaceEnrollmentProgressState;
}

export const FACE_ENROLLMENT_STEPS: readonly FaceEnrollmentStep[] = [
  {
    pose: 'front',
    label: 'Front',
    prompt: 'Look straight ahead',
    instruction: 'Keep your face centered in the guide.'
  },
  {
    pose: 'slight_left',
    label: 'Slight left',
    prompt: 'Slowly turn left',
    instruction: 'Move gently and keep your face visible.'
  },
  {
    pose: 'left',
    label: 'Left',
    prompt: 'Turn left',
    instruction: 'Hold the pose when the guide responds.'
  },
  {
    pose: 'slight_right',
    label: 'Slight right',
    prompt: 'Turn slightly right',
    instruction: 'Move through centre, then hold still.'
  },
  {
    pose: 'right',
    label: 'Right',
    prompt: 'Turn right',
    instruction: 'Keep your face inside the outline.'
  },
  {
    pose: 'chin_up',
    label: 'Look up',
    prompt: 'Look up',
    instruction: 'Raise your chin slightly, then pause.'
  },
  {
    pose: 'chin_down',
    label: 'Look down',
    prompt: 'Look down',
    instruction: 'Lower your chin slightly, then pause.'
  },
  {
    pose: 'blink',
    label: 'Blink',
    prompt: 'Blink',
    instruction: 'Blink once naturally, then hold still.',
    optional: true
  }
];

export const REQUIRED_FACE_ENROLLMENT_STEPS = FACE_ENROLLMENT_STEPS.filter(
  (step) => !step.optional
);

export function faceEnrollmentCompletedPoses(captures: readonly FaceEnrollmentCapture[]) {
  return new Set(captures.map((capture) => capture.pose));
}

export function createFaceEnrollmentProgressDots(
  captures: readonly FaceEnrollmentCapture[],
  stepIndex: number
): FaceEnrollmentProgressDot[] {
  const completed = faceEnrollmentCompletedPoses(captures);
  return FACE_ENROLLMENT_STEPS.map((step, index) => ({
    key: step.pose,
    state: completed.has(step.pose) ? 'done' : index === stepIndex ? 'current' : 'pending'
  }));
}

export function hasRequiredEnrollmentCaptures(captures: readonly FaceEnrollmentCapture[]) {
  const completed = faceEnrollmentCompletedPoses(captures);
  return REQUIRED_FACE_ENROLLMENT_STEPS.every((step) => completed.has(step.pose));
}

export function isFaceEnrollmentComplete(captures: readonly FaceEnrollmentCapture[]) {
  return hasRequiredEnrollmentCaptures(captures);
}
