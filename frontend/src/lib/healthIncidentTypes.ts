// Kept simple and extensible per spec — free text on the backend, this is just the suggested
// list shown in pickers. Shared between correcting an AI-detected alert's event type and the
// manual "Create health report" form, since both draw from the same vocabulary.
export const SUGGESTED_INCIDENT_TYPES = [
  'Fall',
  'Nosebleed',
  'Physical distress',
  'Injury',
  'Allergic reaction',
  'Seizure',
  'Breathing difficulty',
  'Vomiting / Nausea',
  'Fever / Feeling unwell',
  'Other'
];
