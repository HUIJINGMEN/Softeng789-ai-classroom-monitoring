import { useMemo, useState } from 'react';
import CameraCapturePanel from './CameraCapturePanel';
import { analyseHeadPose, detectFace, validateFaceQuality } from '../lib/aiMockService';
import {
  createFaceEnrollmentProgressDots,
  faceEnrollmentCompletedPoses,
  hasRequiredEnrollmentCaptures,
  REQUIRED_FACE_ENROLLMENT_STEPS
} from '../lib/faceEnrollment';
import type { FaceEnrollmentCapture } from '../types';

interface Props {
  readonly captures: FaceEnrollmentCapture[];
  readonly onChange: (captures: FaceEnrollmentCapture[]) => void;
}

export default function FaceEnrollmentFlow({ captures, onChange }: Props) {
  const [stepIndex, setStepIndex] = useState(() => {
    const firstIncomplete = REQUIRED_FACE_ENROLLMENT_STEPS.findIndex(
      (step) => !captures.some((capture) => capture.pose === step.pose)
    );
    return firstIncomplete < 0 ? REQUIRED_FACE_ENROLLMENT_STEPS.length - 1 : firstIncomplete;
  });
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('Hold still');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');

  const step = REQUIRED_FACE_ENROLLMENT_STEPS[stepIndex];
  const completed = useMemo(() => faceEnrollmentCompletedPoses(captures), [captures]);
  const completedRequiredCount = REQUIRED_FACE_ENROLLMENT_STEPS.filter((candidate) =>
    completed.has(candidate.pose)
  ).length;
  const enrollmentComplete = hasRequiredEnrollmentCaptures(captures);
  const progressDots = createFaceEnrollmentProgressDots(captures, stepIndex).slice(
    0,
    REQUIRED_FACE_ENROLLMENT_STEPS.length
  );

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

    const nextIncompleteIndex = REQUIRED_FACE_ENROLLMENT_STEPS.findIndex(
      (candidate) => !nextCaptures.some((capture) => capture.pose === candidate.pose)
    );
    if (nextIncompleteIndex >= 0) {
      window.setTimeout(() => {
        setStepIndex(nextIncompleteIndex);
        setStatus('idle');
        setMessage('Hold still');
      }, 520);
    }
  };

  return (
    <div className="face-enrollment">
      <CameraCapturePanel
        title={enrollmentComplete ? 'Required captures complete' : step.prompt}
        instruction={step.instruction}
        eyebrow={`Face enrollment · ${completedRequiredCount}/${REQUIRED_FACE_ENROLLMENT_STEPS.length}`}
        captureLabel="Retake"
        busy={checking}
        status={status}
        statusText={message}
        progressDots={progressDots}
        completionText={
          enrollmentComplete
            ? 'This face set is ready to submit securely.'
            : undefined
        }
        autoCapture={{
          enabled: !enrollmentComplete,
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
