const LEADING_IMPORT_NOISE_REGEX = /^[^\p{L}\p{N}]+/u;

const sanitizeImportedText = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  const normalizedValue = String(value)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim();
  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.replace(LEADING_IMPORT_NOISE_REGEX, '').trim();
};

const sanitizeUniversityRoll = (value) => {
  return sanitizeImportedText(value);
};

module.exports = {
  sanitizeImportedText,
  sanitizeUniversityRoll
};
