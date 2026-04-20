const prisma = require('../config/prisma');

/**
 * Generate unique certificate number
 * Format: SSDM/{TYPE}/{YEAR}/{RUNNING_NUMBER}
 * @param {String} type - Certificate type (CLC, BONAFIDE, CHARACTER)
 * @returns {String} Certificate number
 */
exports.generateCertificateNo = async (type) => {
  const year = new Date().getFullYear();
  
  // Get count of certificates for this type and year
  const count = await prisma.certificateRequest.count({
    where: {
      type,
      certificateNo: {
        contains: `/${year}/`
      }
    }
  });
  
  const runningNumber = String(count + 1).padStart(4, '0');
  return `SSDM/${type}/${year}/${runningNumber}`;
};
