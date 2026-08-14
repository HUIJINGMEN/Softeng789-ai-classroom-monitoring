import type { Student, TeacherNote } from '../types';

export const STUDENTS: Student[] = [
  { id: 'UOA-100241', name: 'Amelia Chen', course: 'COMPSCI 335', rate: 96, status: 'Active', program: 'BSc Computer Science, Year 2', email: 'ache241@aucklanduni.ac.nz', seat: 'C-04' },
  { id: 'UOA-100258', name: 'Rāwiri Thompson', course: 'COMPSCI 335', rate: 88, status: 'Active', program: 'BE(Hons) Software, Year 2', email: 'rtho258@aucklanduni.ac.nz', seat: 'B-11' },
  { id: 'UOA-100263', name: 'Priya Balakrishnan', course: 'COMPSCI 335', rate: 92, status: 'Active', program: 'BSc Computer Science, Year 3', email: 'pbal263@aucklanduni.ac.nz', seat: 'A-02' },
  { id: 'UOA-100277', name: 'Daniel Okafor', course: 'COMPSCI 335', rate: 74, status: 'At risk', program: 'BSc Computer Science, Year 2', email: 'doka277@aucklanduni.ac.nz', seat: 'D-07' },
  { id: 'UOA-100284', name: 'Sofia Marchetti', course: 'INFOSYS 222', rate: 98, status: 'Active', program: 'BCom Information Systems, Year 1', email: 'smar284@aucklanduni.ac.nz', seat: 'A-09' },
  { id: 'UOA-100291', name: 'Hemi Ngata', course: 'INFOSYS 222', rate: 81, status: 'Active', program: 'BCom Information Systems, Year 2', email: 'hnga291@aucklanduni.ac.nz', seat: 'C-01' },
  { id: 'UOA-100305', name: 'Yuki Tanaka', course: 'COMPSCI 335', rate: 90, status: 'Active', program: 'BSc Computer Science, Year 2', email: 'ytan305@aucklanduni.ac.nz', seat: 'B-06' },
  { id: 'UOA-100312', name: "Liam O'Connell", course: 'ENGSCI 233', rate: 68, status: 'At risk', program: 'BE(Hons) Engineering Science, Year 2', email: 'loco312@aucklanduni.ac.nz', seat: 'E-03' },
  { id: 'UOA-100320', name: 'Nadia Farouk', course: 'ENGSCI 233', rate: 94, status: 'Active', program: 'BE(Hons) Engineering Science, Year 3', email: 'nfar320@aucklanduni.ac.nz', seat: 'A-05' },
  { id: 'UOA-100337', name: 'Ethan Whitmore', course: 'COMPSCI 335', rate: 86, status: 'Active', program: 'BSc Computer Science, Year 1', email: 'ewhi337@aucklanduni.ac.nz', seat: 'D-02' },
  { id: 'UOA-100344', name: 'Mei-Ling Zhou', course: 'INFOSYS 222', rate: 91, status: 'Active', program: 'BCom Information Systems, Year 3', email: 'mzho344@aucklanduni.ac.nz', seat: 'B-08' },
  { id: 'UOA-100359', name: 'Tomás Rivera', course: 'COMPSCI 335', rate: 79, status: 'Enrolment pending', program: 'BSc Computer Science, Year 2', email: 'triv359@aucklanduni.ac.nz', seat: 'C-10' },
  { id: 'UOA-100366', name: "Grace Fetu'u", course: 'ENGSCI 233', rate: 89, status: 'Active', program: 'BE(Hons) Engineering Science, Year 1', email: 'gfet366@aucklanduni.ac.nz', seat: 'A-11' },
  { id: 'UOA-100371', name: 'Jonas Brandt', course: 'INFOSYS 222', rate: 83, status: 'Active', program: 'BCom Information Systems, Year 2', email: 'jbra371@aucklanduni.ac.nz', seat: 'E-06' }
];

export const TEACHER_NOTES: TeacherNote[] = [
  { text: 'Contributes thoughtfully in workshop discussion; asked a strong question about lock granularity.', author: 'Dr. D. Kessler', date: 'Aug 5, 2026' },
  { text: 'Follow-up after two late arrivals — student reported a timetable clash with a lab. Resolved.', author: 'Dr. D. Kessler', date: 'Jul 31, 2026' },
  { text: 'Assignment 1 feedback discussed in office hours. Clear improvement plan agreed.', author: 'T. Alvarez (Tutor)', date: 'Jul 24, 2026' }
];
