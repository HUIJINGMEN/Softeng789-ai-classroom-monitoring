import type { EventType } from '../types';

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
