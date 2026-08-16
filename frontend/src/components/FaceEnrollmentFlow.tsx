import { useMemo, useState } from 'react';
import CameraCapturePanel from './CameraCapturePanel';
import { analyseHeadPose, detectFace, validateFaceQuality } from '../lib/aiMockService';
import {
  createFaceEnrollmentProgressDots,
  faceEnrollmentCompletedPoses,
  FACE_ENROLLMENT_STEPS,
  isFaceEnrollmentComplete
} from '../lib/faceEnrollment';
import type { FaceEnrollmentCapture } from '../types';

interface Props {
  captures: FaceEnrollmentCapture[];
  onChange: (captures: FaceEnrollmentCapture[]) => void;
}

export default function FaceEnrollmentFlow({ captures, onChange }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('Hold still');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');

  const step = FACE_ENROLLMENT_STEPS[stepIndex];
  const completed = useMemo(() => faceEnrollmentCompletedPoses(captures), [captures]);
  const enrollmentComplete = isFaceEnrollmentComplete(captures);
  const progressDots = createFaceEnrollmentProgressDots(captures, stepIndex);

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

    if (stepIndex < FACE_ENROLLMENT_STEPS.length - 1) {
      window.setTimeout(() => {
        setStepIndex((current) => Math.min(current + 1, FACE_ENROLLMENT_STEPS.length - 1));
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
