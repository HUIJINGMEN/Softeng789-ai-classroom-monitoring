import type { FaceDecision, PhotoReview } from './types';

/** Require an explicit selection for every face; suggested identities are never preselected. */
export function buildDecisions(review: PhotoReview, choices: Record<string, string>, late: Record<string, boolean>): FaceDecision[] {
  const eligible = new Set(review.result.roster.map((student) => student.studentId));
  const selected = new Set<string>();
  return review.result.recognition.faces.map((face) => {
    const choice = choices[face.faceId];
    if (!choice) throw new Error('Review every face, including faces to exclude.');
    if (choice === 'EXCLUDE') return { faceId: face.faceId, studentId: null, status: 'EXCLUDE' };
    if (!eligible.has(choice)) throw new Error('This student is no longer eligible. Reload the class roster.');
    if (selected.has(choice)) throw new Error('A student can only be selected once in a photo.');
    selected.add(choice);
    return { faceId: face.faceId, studentId: choice, status: late[face.faceId] ? 'LATE' : 'PRESENT' };
  });
}
