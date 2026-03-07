const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.generateReceiptPDF = async (payment) => {
  const filePath = path.join("/tmp", `receipt-${payment.receiptNo}.pdf`);
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  doc.fontSize(18).text("SEMESTER PAYMENT RECEIPT", { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Receipt No: ${payment.receiptNo}`);
  doc.text(`Student Name: ${payment.student.name}`);
  doc.text(`Registration No: ${payment.student.reg_no}`);
  doc.text(`University Roll No: ${payment.student.university_roll || 'N/A'}`);
  doc.text(`Amount Paid: ₹${payment.totalAmount}`);
  doc.text(`Payment Status: ${payment.status}`);
  doc.text(`Date: ${new Date().toLocaleString()}`);

  doc.moveDown();
  doc.text("Fee Breakup:", { underline: true });

  payment.breakups.forEach(b => {
    doc.text(`${b.head}: ₹${b.amount}`);
  });

  doc.moveDown(4);
  doc.text("Authorized Signature", { align: "right" });

  doc.end();
  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    doc.on("error", reject);
  });

  return filePath;
};

exports.generateCertificatePDF = async (student, admission) => {
  const filePath = `/tmp/certificate-${student.university_roll || student.reg_no}.pdf`;
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  doc.fontSize(20).text("ADMISSION CERTIFICATE", { align: "center" });
  doc.moveDown(2);

  doc.fontSize(14).text(
    `This is to certify that ${student.name} has successfully taken admission and completed payment formalities.`,
    { align: "center" }
  );

  doc.moveDown(5);
  doc.text("College Authority", { align: "right" });

  doc.end();
  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    doc.on("error", reject);
  });

  return filePath;
};
