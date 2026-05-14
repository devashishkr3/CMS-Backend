/**
 * Human-readable certificate type labels (receipts, PDFs, logs).
 */
exports.formatCertificateTypeLabel = (type) => {
  const labels = {
    BONAFIDE: 'Bonafide Certificate',
    CLC_CHARACTER: 'CLC + Character',
    CLC: 'College Leaving Certificate (CLC)',
    CHARACTER: 'Character Certificate',
  };
  return labels[type] || type || 'Certificate';
};
