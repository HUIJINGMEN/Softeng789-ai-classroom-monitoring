import type { FaceEnrollmentPose } from '../types';

export interface FaceDetectionResult {
  faceDetected: boolean;
  confidence: number;
  message: string;
}

export interface FaceQualityResult {
  accepted: boolean;
  score: number;
  issues: string[];
  message: string;
}

export interface HeadPoseResult {
  accepted: boolean;
  expectedPose: FaceEnrollmentPose;
  score: number;
  message: string;
}

const MOCK_DELAY_MS = 520;

export async function detectFace(photo: string): Promise<FaceDetectionResult> {
  await delay(MOCK_DELAY_MS);
  const usable = photo.startsWith('data:image/');
  return {
    faceDetected: usable,
    confidence: usable ? 0.92 : 0,
    message: usable ? 'Face detected in the guide area.' : 'No usable camera frame was captured.'
  };
}

export async function validateFaceQuality(photo: string): Promise<FaceQualityResult> {
  await delay(MOCK_DELAY_MS);
  if (!photo.startsWith('data:image/')) {
    return {
      accepted: false,
      score: 0,
      issues: ['No image data'],
      message: 'Capture a clear frame before continuing.'
    };
  }

  const score = 0.84 + (hash(photo) % 12) / 100;
  const issues = score < 0.88 ? ['Move closer to the guide frame'] : [];

  return {
    accepted: score >= 0.84,
    score: roundScore(score),
    issues,
    message:
      score >= 0.88
        ? 'Image quality looks good.'
        : 'Image accepted. A closer, centered capture would be better.'
  };
}

export async function analyseHeadPose(
  photo: string,
  expectedPose: FaceEnrollmentPose
): Promise<HeadPoseResult> {
  await delay(MOCK_DELAY_MS);
  const base = photo.startsWith('data:image/') ? 0.86 : 0.2;
  const score = roundScore(base + (poseWeight(expectedPose) % 8) / 100);
  return {
    accepted: score >= 0.82,
    expectedPose,
    score,
    message: score >= 0.82 ? 'Pose matched the requested direction.' : 'Pose did not match.'
  };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hash(value: string) {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) >>> 0;
  }
  return result;
}

function poseWeight(pose: FaceEnrollmentPose) {
  return pose.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function roundScore(value: number) {
  return Math.min(0.99, Math.max(0, Math.round(value * 100) / 100));
}
