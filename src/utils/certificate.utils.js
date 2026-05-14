const prisma = require('../config/prisma');

/**
 * Highest running number for SSDM/{series}/{year}/#### this calendar year,
 * considering both primary and character certificate numbers.
 */
async function maxRunningNumberForSeries(series) {
  const year = new Date().getFullYear();
  const prefix = `SSDM/${series}/${year}/`;
  const rows = await prisma.certificateRequest.findMany({
    where: {
      OR: [
        { certificateNo: { startsWith: prefix } },
        { characterCertificateNo: { startsWith: prefix } },
      ],
    },
    select: { certificateNo: true, characterCertificateNo: true },
  });

  let max = 0;
  for (const row of rows) {
    for (const val of [row.certificateNo, row.characterCertificateNo]) {
      if (!val || !val.startsWith(prefix)) continue;
      const n = parseInt(val.slice(prefix.length), 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  return max;
}

/**
 * Generate unique certificate number
 * Format: SSDM/{SERIES}/{YEAR}/{RUNNING_NUMBER}
 * @param {String} series - CLC | CHARACTER | BONAFIDE (document series, not always DB enum)
 */
exports.generateCertificateNo = async (series) => {
  const year = new Date().getFullYear();
  const prefix = `SSDM/${series}/${year}/`;
  const max = await maxRunningNumberForSeries(series);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
};
