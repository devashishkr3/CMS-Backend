/**
 * Certificate Module Constants
 * Shared between frontend and backend validation
 */

// Valid Department Names
exports.VALID_DEPARTMENTS = [
  'PHYSICS',
  'CHEMISTRY',
  'BOTANY',
  'ZOOLOGY',
  'MATHEMATICS',
  'HINDI',
  'ENGLISH',
  'URDU',
  // 'GEOGRAPHY',
  'PSYCHOLOGY',
  'SOCIOLOGY',
  'HISTORY',
  'POLITICAL SCIENCE',
  'ECONOMICS',
  'HOME SCIENCE',
  'SANSKRIT',
];

// Valid Course Names
exports.VALID_COURSES = [
  'BSC',
  'BA',
  'BCOM'
];

// Valid Semesters / parts (Bonafide: student selects; CLC+Character uses PART 3 server-side)
exports.VALID_SEMESTERS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  'PART 1',
  'PART 2',
  'PART 3',
];

// Valid Sessions
exports.VALID_SESSIONS = [
  '2022-2025',
];

// Certificate Fees (legacy CLC / CHARACTER kept for existing rows & payments)
exports.CERTIFICATE_FEES = {
  BONAFIDE: 100,
  CLC_CHARACTER: 500,
  CLC: 500,
  CHARACTER: 300,
};

// Certificate Types (apply flow uses BONAFIDE + CLC_CHARACTER)
exports.CERTIFICATE_TYPES = ['BONAFIDE', 'CLC_CHARACTER', 'CLC', 'CHARACTER'];

// Certificate Statuses
exports.CERTIFICATE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ISSUED'];
