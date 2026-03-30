const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.generateReceiptPDF = async (payment) => {
  const filePath = path.join("/tmp", `receipt-${payment.receiptNo}.pdf`);

  const doc = new PDFDocument({
    size: "A4",
    margin: 50
  });

  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // =========================
  // LOGO PATH
  // =========================
  const logoPath = path.join(__dirname, "/SSDM_logo.png"); 
  // apna actual logo path yaha dena

  // =========================
  // HEADER SECTION
  // =========================

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 60, 55, { width: 70 });
  }

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("SANT SANDHYADAS MAHILA COLLEGE", 90, 60, {
      align: "center"
    });

  doc
    .fontSize(13)
    .font("Helvetica")
    .text("Gulabbagh, Barh, Patna", {
      align: "center"
    });

  doc
    .fontSize(13)
    .text("Affiliated to PPU, Patna", {
      align: "center"
    });

  doc
    .fontSize(13)
    .text("College Code: 435", {
      align: "center"
    });

  doc.moveDown(2);

  // =========================
  // TITLE
  // =========================

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text("SEMESTER IV PAYMENT RECEIPT", {
      align: "center",
      underline: true
    });

  doc.moveDown(2);

  // =========================
  // RECEIPT DETAILS
  // =========================

  doc.font("Helvetica").fontSize(12);

  doc.text(`Receipt No:  ${payment.receiptNo}`);
  doc.moveDown();

  doc.text(`Student Name:  ${payment.student.name}`);
  doc.moveDown();

  doc.text(`University Roll No:  ${payment.student.university_roll || "N/A"}`);
  doc.moveDown();

  doc.text(`College Roll No:  ${payment.student.college_roll || "N/A"}`);
  doc.moveDown();

  doc.text(`Session :  2024-2028`);
  doc.moveDown();

  // FIXED Amount Issue
  doc.text(`Amount Paid:  Rs. ${payment.totalAmount}`);
  doc.moveDown();

  doc.text(`Payment Status:  ${payment.status}`);
  doc.moveDown();

  doc.text(`Date:  ${new Date().toLocaleString()}`);

  doc.moveDown();
  doc.moveDown();
  doc.moveDown();
  doc.moveDown();

  // =========================
  // FEE BREAKUP
  // =========================

  // doc
  //   .font("Helvetica-Bold")
  //   .text("Fee Breakup:", {
  //     underline: true
  //   });

  // doc.font("Helvetica");

  // payment.breakups.forEach((b) => {
  //   doc.text(`${b.head}: Rs. ${b.amount}`);
  // });

  doc.moveDown(4);

  // =========================
  // SIGNATURE
  // =========================

  doc.text("Authorized Signature", {
    align: "right"
  });

  // =========================
  // FOOTER LINE
  // =========================

  doc.moveDown();
  doc
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke();

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    doc.on("error", reject);
  });

  return filePath;
};
