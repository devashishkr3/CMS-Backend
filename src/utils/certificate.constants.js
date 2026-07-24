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
  'PHILOSOPHY',
  'PA',
  'AIAS',
  'LSW'
];

// Valid Course Names
exports.VALID_COURSES = [
  'BSC',
  'BA',
  'BCOM'
];

// Valid Semesters
exports.VALID_SEMESTERS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  'part_3rd',
];

// Valid Sessions
exports.VALID_SESSIONS = [
  '2022-2025',
  '2023-2027',
  '2024-2028',
  '2025-2029',
  '2026-2030'
];

// Certificate Fees
exports.CERTIFICATE_FEES = {
  BONAFIDE: 100,
  CLC: 500,
  CHARACTER: 300
};

// Certificate Types
exports.CERTIFICATE_TYPES = ['BONAFIDE', 'CLC', 'CHARACTER'];

// Certificate Statuses
exports.CERTIFICATE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ISSUED'];
