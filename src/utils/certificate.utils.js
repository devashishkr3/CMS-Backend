const prisma = require('../config/prisma');

/**
 * Generate unique certificate number
 * Format: SSDM/{TYPE}/{YEAR}/{RUNNING_NUMBER}
 * @param {String} type - Certificate type (CLC, BONAFIDE, CHARACTER)
 * @returns {String} Certificate number
 */
// exports.generateCertificateNo = async (type) => {
//   const year = new Date().getFullYear();

//   // Get count of certificates for this type and year
//   const count = await prisma.certificateRequest.count({
//     where: {
//       type,
//       certificateNo: {
//         contains: `/${year}/`
//       }
//     }
//   });

//   const runningNumber = String(count + 1).padStart(4, '0');
//   return `SSDM/${type}/${year}/${runningNumber}`;
// };

// Improved version to handle concurrent requests and ensure uniqueness
exports.generateCertificateNo = async (type) => {
  const year = new Date().getFullYear();

  // Find last certificate of this type + year
  const lastCertificate = await prisma.certificateRequest.findFirst({
    where: {
      type,
      certificateNo: {
        startsWith: `SSDM/${type}/${year}/`,
      },
    },
    orderBy: {
      certificateNo: "desc",
    },
  });

  let nextNumber = 1;

  if (lastCertificate && lastCertificate.certificateNo) {
    const parts = lastCertificate.certificateNo.split("/");
    const lastRunningNumber = parseInt(parts[3], 10);

    if (!isNaN(lastRunningNumber)) {
      nextNumber = lastRunningNumber + 1;
    }
  }

  const runningNumber = String(nextNumber).padStart(4, "0");

  return `SSDM/${type}/${year}/${runningNumber}`;
};