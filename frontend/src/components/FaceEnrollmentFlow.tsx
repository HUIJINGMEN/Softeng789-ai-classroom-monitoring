import { useMemo, useState } from 'react';
import CameraCapturePanel from './CameraCapturePanel';
import { analyseHeadPose, detectFace, validateFaceQuality } from '../lib/aiMockService';
import type { FaceEnrollmentCapture, FaceEnrollmentPose } from '../types';

interface EnrollmentStep {
  pose: FaceEnrollmentPose;
  label: string;
  prompt: string;
  instruction: string;
  optional?: boolean;
}

interface Props {
  captures: FaceEnrollmentCapture[];
  onChange: (captures: FaceEnrollmentCapture[]) => void;
}

const STEPS: EnrollmentStep[] = [
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

export default function FaceEnrollmentFlow({ captures, onChange }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('Hold still');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');

  const step = STEPS[stepIndex];
  const completed = useMemo(
    () => new Set(captures.map((capture) => capture.pose)),
    [captures]
  );
  const requiredCount = STEPS.filter((candidate) => !candidate.optional).length;
  const completedRequired = captures.filter((capture) => !capture.optional).length;
  const enrollmentComplete = completedRequired === requiredCount;
  const progressDots: Array<{
    key: string;
    state: 'pending' | 'current' | 'done';
  }> = STEPS.map((candidate, index) => ({
    key: candidate.pose,
    state: completed.has(candidate.pose)
      ? 'done'
      : index === stepIndex
        ? 'current'
        : 'pending'
  }));

  const captureStep = async (photo: string) => {
    setChecking(true);
    setStatus('checking');
    setMessage('Hold still');

    const face = await detectFace(photo);
    if (!face.faceDetected) {
      setChecking(false);
      setStatus('error');
      setMessage(face.message || 'Move closer');
      return;
    }

    const [quality, pose] = await Promise.all([
      validateFaceQuality(photo),
      analyseHeadPose(photo, step.pose)
    ]);

    if (!quality.accepted || !pose.accepted) {
      setChecking(false);
      setStatus('error');
      setMessage(
        quality.issues[0]
          ? quality.issues[0]
          : 'Action did not match the prompt'
      );
      return;
    }

    const nextCapture: FaceEnrollmentCapture = {
      pose: step.pose,
      label: step.label,
      photo,
      qualityScore: quality.score,
      poseScore: pose.score,
      capturedAt: new Date().toISOString(),
      optional: step.optional
    };

    const nextCaptures = [
      ...captures.filter((capture) => capture.pose !== step.pose),
      nextCapture
    ];
    onChange(nextCaptures);
    setChecking(false);
    setStatus('success');
    setMessage('Captured');

    if (stepIndex < STEPS.length - 1) {
      window.setTimeout(() => {
        setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
        setStatus('idle');
        setMessage('Hold still');
      }, 520);
    }
  };

  return (
    <div className="face-enrollment">
      <CameraCapturePanel
        title={enrollmentComplete && completed.has('blink') ? 'Enrollment complete' : step.prompt}
        instruction={step.instruction}
        eyebrow="Face enrollment"
        captureLabel="Retake"
        busy={checking}
        status={status}
        statusText={message}
        progressDots={progressDots}
        completionText={
          enrollmentComplete && completed.has('blink')
            ? 'Face set saved locally when you save the student.'
            : undefined
        }
        autoCapture={{
          enabled: true,
          delayMs: 1700,
          triggerKey: `${step.pose}-${captures.length}`,
          label: 'Hold still'
        }}
        showCaptureButton={status === 'error'}
        showResetButton={false}
        hudMode="minimal"
        onCapture={(photo) => void captureStep(photo)}
      />
    </div>
  );
}

export function frontEnrollmentPhoto(captures: readonly FaceEnrollmentCapture[]) {
  return captures.find((capture) => capture.pose === 'front')?.photo ?? captures[0]?.photo ?? '';
}

export function hasRequiredEnrollmentCaptures(captures: readonly FaceEnrollmentCapture[]) {
  const completed = new Set(captures.map((capture) => capture.pose));
  return STEPS.filter((step) => !step.optional).every((step) => completed.has(step.pose));
}
