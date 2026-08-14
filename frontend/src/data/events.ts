import type { CandidateEvent, EventType } from '../types';

/**
 * Simulated detector output. In a real system `confidence` would combine the
 * detector's box score with the share of frames in the window that met the
 * behaviour threshold, e.g. 0.6 * detectionScore + 0.4 * sustainedFrameRatio.
 * It is a model score, not a probability of being correct.
 */
export const CANDIDATE_EVENTS: CandidateEvent[] = [
  { id: 'E-8841', studentId: 'UOA-100277', trackId: 'T-014', type: 'Prolonged head-down posture', sessionId: 'S-2418', start: '10:14:32', duration: '3m 48s', confidence: 0.82, status: 'Pending Review' },
  { id: 'E-8842', studentId: 'UOA-100359', trackId: 'T-021', type: 'Leaving the seat area', sessionId: 'S-2418', start: '10:21:07', duration: '2m 12s', confidence: 0.91, status: 'Pending Review' },
  { id: 'E-8843', studentId: null, trackId: 'T-009', type: 'Potential peer interaction', sessionId: 'S-2418', start: '10:27:55', duration: '1m 05s', confidence: 0.64, status: 'Pending Review' },
  { id: 'E-8844', studentId: 'UOA-100258', trackId: 'T-003', type: 'Prolonged head-down posture', sessionId: 'S-2418', start: '10:33:19', duration: '5m 02s', confidence: 0.77, status: 'Pending Review' },
  { id: 'E-8830', studentId: 'UOA-100312', trackId: 'T-017', type: 'Leaving the seat area', sessionId: 'S-2414', start: '10:12:41', duration: '6m 34s', confidence: 0.88, status: 'Confirmed' },
  { id: 'E-8831', studentId: 'UOA-100337', trackId: 'T-006', type: 'Prolonged head-down posture', sessionId: 'S-2414', start: '10:39:02', duration: '4m 11s', confidence: 0.71, status: 'Rejected' },
  { id: 'E-8832', studentId: 'UOA-100305', trackId: 'T-012', type: 'Potential peer interaction', sessionId: 'S-2414', start: '10:44:26', duration: '0m 52s', confidence: 0.59, status: 'Corrected', correctedFrom: 'Prolonged head-down posture' },
  { id: 'E-8815', studentId: 'UOA-100291', trackId: 'T-008', type: 'Leaving the seat area', sessionId: 'S-2409', start: '13:48:10', duration: '3m 20s', confidence: 0.86, status: 'Confirmed' },
  { id: 'E-8816', studentId: 'UOA-100371', trackId: 'T-019', type: 'Prolonged head-down posture', sessionId: 'S-2409', start: '14:11:38', duration: '7m 05s', confidence: 0.8, status: 'Pending Review' },
  { id: 'E-8802', studentId: 'UOA-100312', trackId: 'T-004', type: 'Prolonged head-down posture', sessionId: 'S-2402', start: '10:19:44', duration: '4m 48s', confidence: 0.83, status: 'Confirmed' }
];

export const EVENT_TYPES: EventType[] = [
  'Prolonged head-down posture',
  'Leaving the seat area',
  'Potential peer interaction',
  'Extended off-desk hand movement',
  'No observable concern (false positive)'
];

/** Observable-only descriptions. No inference about attention or intent. */
export const EVENT_DESCRIPTIONS: Record<EventType, string> = {
  'Prolonged head-down posture': 'head orientation remained below the desk-line threshold for the recorded duration.',
  'Leaving the seat area': 'the tracked person was outside the assigned seat region for the recorded duration.',
  'Potential peer interaction': 'two tracked persons remained within close proximity with sustained torso orientation toward each other.',
  'Extended off-desk hand movement': 'hand keypoints stayed outside the desk region for the recorded duration.',
  'No observable concern (false positive)': 'the detection was reviewed and no observable condition was met.'
};

export interface TrackBox {
  trackId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

export const TRACK_BOXES: TrackBox[] = [
  { trackId: 'T-003', left: 12, top: 30, width: 11, height: 26, confidence: 0.94 },
  { trackId: 'T-006', left: 29, top: 24, width: 10, height: 24, confidence: 0.91 },
  { trackId: 'T-009', left: 44, top: 33, width: 12, height: 27, confidence: 0.88 },
  { trackId: 'T-012', left: 60, top: 26, width: 10, height: 25, confidence: 0.9 },
  { trackId: 'T-014', left: 20, top: 58, width: 13, height: 29, confidence: 0.86 },
  { trackId: 'T-017', left: 39, top: 61, width: 12, height: 28, confidence: 0.82 },
  { trackId: 'T-019', left: 57, top: 57, width: 13, height: 30, confidence: 0.89 },
  { trackId: 'T-021', left: 74, top: 44, width: 11, height: 26, confidence: 0.79 }
];
