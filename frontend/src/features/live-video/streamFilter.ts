import type { StreamView } from './api';

export function streamsForStudent(streams: readonly StreamView[], studentId?: string): readonly StreamView[] {
  return studentId === undefined ? streams : streams.filter(stream => stream.studentId === studentId);
}
