const prisma = require("../config/prisma");
const { generateReceiptPDF, generateCertificatePDF } = require("../utils/pdfGenerator");
const { uploadFileToR2 } = require("../utils/uploadToR2");

exports.generateReceiptAndCertificate = async (paymentId) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: true, admission: true, breakups: true }
  });

  // Receipt
  const receiptPath = await generateReceiptPDF(payment);
  const receiptUrl = await uploadFileToR2(receiptPath, `receipts/${payment.receiptNo}.pdf`);

  // Certificate
  const certPath = await generateCertificatePDF(payment.student, payment.admission);
  const certUrl = await uploadFileToR2(certPath, `certificates/${payment.student.reg_no}.pdf`);

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      receiptUrl,
      certificateUrl: certUrl
    }
  });
};
