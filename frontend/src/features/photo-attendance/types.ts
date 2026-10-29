export interface FaceProfile {
  enabled: boolean; consentActive: boolean; enrolled: boolean; expiresAt: string | null; noticeVersion: string;
}
export interface RosterStudent {
  studentId: string; name: string; studentNumber: string; consentActive: boolean; enrolled: boolean;
}
export interface PhotoFace {
  faceId: string;
  box: { x: number; y: number; width: number; height: number };
  decision: 'MATCH_CANDIDATE' | 'UNCERTAIN' | 'UNKNOWN' | 'LOW_QUALITY';
  qualityReasons: string[];
  candidates: { studentId: string; similarity: number }[];
}
export interface PhotoReview {
  id: string; state: 'PENDING' | 'REVIEWED'; expiresAt: string;
  result: { recognition: { faces: PhotoFace[]; modelVersion: string; thresholdVersion: string }; roster: RosterStudent[] };
}
export interface FaceDecision { faceId: string; studentId: string | null; status: 'PRESENT' | 'LATE' | 'EXCLUDE' }
