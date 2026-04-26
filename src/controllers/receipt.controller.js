const prisma = require("../config/prisma");
const fs = require("fs");
const { generateReceiptPDF, generateCertificatePDF } = require("../utils/pdfGenerator");
const { uploadFileToR2 } = require("../utils/uploadToR2");

exports.generateReceiptAndCertificate = async (paymentId) => {
  // Fetch payment with certificate data (for certificate payments)
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { 
      student: true, 
      admission: true, 
      breakups: true,
      certificate: true  // Include certificate data
    }
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  // Receipt (persist URL if upload succeeds)
  const receiptPath = await generateReceiptPDF(payment);
  let receiptUrl = null;
  try {
    receiptUrl = await uploadFileToR2(receiptPath, `receipts/${payment.receiptNo}.pdf`);
  } catch (err) {
    // Keep non-fatal: UI can still use on-demand invoice endpoint.
    console.warn("Receipt upload failed:", err.message);
  }

  if (receiptUrl) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { receiptUrl }
    });
  }
  fs.promises.unlink(receiptPath).catch(() => {});

  // Handle certificate-specific generation
  if (payment.certificateId && payment.certificate) {
    // Certificate payments: certificate PDF is generated during approval, not here
    console.log(`Receipt generated for certificate payment: ${payment.certificate.type}`);
  } else {
    // Admission payments: generate certificate as before
    try {
      const certPath = await generateCertificatePDF(payment.student, payment.admission);
      await uploadFileToR2(certPath, `certificates/${payment.student.reg_no}.pdf`);
      fs.promises.unlink(certPath).catch(() => {});
    } catch (err) {
      console.warn("Certificate generation/upload failed:", err.message);
    }
  }
};
