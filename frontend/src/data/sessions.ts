import type { Session } from '../types';

export const SESSIONS: Session[] = [
  { id: 'S-2418', course: 'COMPSCI 335', title: 'Lecture 12 — Concurrent Systems', room: 'Room 405-460', date: '2026-08-07', dateLabel: 'Aug 7, 2026', time: '10:00–11:00', enrolled: 42, status: 'Live' },
  { id: 'S-2414', course: 'COMPSCI 335', title: 'Lecture 11 — Memory Models', room: 'Room 405-460', date: '2026-08-05', dateLabel: 'Aug 5, 2026', time: '10:00–11:00', enrolled: 42, status: 'Completed' },
  { id: 'S-2409', course: 'INFOSYS 222', title: 'Workshop 6 — Database Design', room: 'Room 260-098', date: '2026-08-04', dateLabel: 'Aug 4, 2026', time: '13:00–15:00', enrolled: 36, status: 'Completed' },
  { id: 'S-2402', course: 'COMPSCI 335', title: 'Lecture 10 — Scheduling', room: 'Room 405-460', date: '2026-07-31', dateLabel: 'Jul 31, 2026', time: '10:00–11:00', enrolled: 42, status: 'Completed' },
  { id: 'S-2396', course: 'ENGSCI 233', title: 'Lab 4 — Numerical Methods', room: 'Room 401-401', date: '2026-07-29', dateLabel: 'Jul 29, 2026', time: '09:00–11:00', enrolled: 28, status: 'Completed' }
];

export const COURSES = ['All courses', 'COMPSCI 335', 'INFOSYS 222', 'ENGSCI 233'] as const;
