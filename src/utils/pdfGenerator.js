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
  // TITLE - Dynamic based on payment type
  // =========================

  const isCertificatePayment = payment.certificateId && payment.certificate;
  
  if (isCertificatePayment) {
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(`${payment.certificate.type} CERTIFICATE PAYMENT RECEIPT`, {
        align: "center",
        underline: true
      });
  } else {
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("SEMESTER IV PAYMENT RECEIPT", {
        align: "center",
        underline: true
      });
  }

  doc.moveDown(2);

  // =========================
  // PAYMENT DETAILS
  // =========================

  doc.font("Helvetica").fontSize(12);

  doc.text(`Receipt No:  ${payment.receiptNo}`);
  doc.moveDown();

  doc.text(`Transaction ID:  ${payment.txnId}`);
  doc.moveDown();

  doc.text(`Date:  ${new Date(payment.createdAt).toLocaleString('en-IN')}`);
  doc.moveDown();

  // =========================
  // STUDENT/CERTIFICATE DETAILS
  // =========================

  if (isCertificatePayment) {
    // Certificate payment details
    doc.text(`Student Name:  ${payment.certificate.name || 'N/A'}`);
    doc.moveDown();
    
    doc.text(`Father's Name:  ${payment.certificate.fatherName || 'N/A'}`);
    doc.moveDown();
    
    doc.text(`Certificate Type:  ${payment.certificate.type}`);
    doc.moveDown();
    
    if (payment.certificate.universityRoll) {
      doc.text(`University Roll:  ${payment.certificate.universityRoll}`);
      doc.moveDown();
    }
    
    if (payment.certificate.courseName) {
      doc.text(`Course:  ${payment.certificate.courseName}`);
      doc.moveDown();
    }
    
    if (payment.certificate.departmentName) {
      doc.text(`Department:  ${payment.certificate.departmentName}`);
      doc.moveDown();
    }
    
    if (payment.certificate.semester) {
      doc.text(`Semester:  ${payment.certificate.semester}`);
      doc.moveDown();
    }
    
    if (payment.certificate.session) {
      doc.text(`Session:  ${payment.certificate.session}`);
      doc.moveDown();
    }
  } else {
    // Admission payment details
    if (payment.student) {
      doc.text(`Student Name:  ${payment.student.name || 'N/A'}`);
      doc.moveDown();
      
      doc.text(`University Roll No:  ${payment.student.university_roll || 'N/A'}`);
      doc.moveDown();
      
      doc.text(`College Roll No:  ${payment.student.class_roll || 'N/A'}`);
      doc.moveDown();
      
      doc.text(`Session :  2024-2028`);
      doc.moveDown();
    }
  }

  // =========================
  // AMOUNT
  // =========================

  doc.text(`Amount Paid:  Rs. ${payment.totalAmount}`);
  doc.moveDown();

  doc.text(`Payment Status:  ${payment.status}`);
  doc.moveDown();

  if (payment.gateway) {
    doc.text(`Payment Gateway:  ${payment.gateway}`);
    doc.moveDown();
  }

  doc.moveDown();
  doc.moveDown();
  doc.moveDown();
  doc.moveDown();

  // =========================
  // FEE BREAKUP (if available)
  // =========================

  if (payment.breakups && payment.breakups.length > 0) {
    doc
      .font("Helvetica-Bold")
      .text("Fee Breakup:", {
        underline: true
      });

    doc.font("Helvetica");

    payment.breakups.forEach((b) => {
      doc.text(`${b.head}: Rs. ${b.amount}`);
    });
    
    doc.moveDown(2);
  }

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
