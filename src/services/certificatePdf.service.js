const puppeteer = require('puppeteer');
const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const fs = require('fs');
const path = require('path');

/**
 * Generate certificate PDF using Puppeteer
 * @param {String} certificateId - Certificate request ID
 * @returns {Object} File path, URL, and buffer
 */
exports.generateCertificatePDF = async (certificateId) => {
  const certificate = await prisma.certificateRequest.findUnique({
    where: { id: certificateId }
  });

  if (!certificate) {
    throw new AppError('Certificate not found', 404);
  }

  if (certificate.status !== 'APPROVED' && certificate.status !== 'PENDING') {
    throw new AppError('Certificate cannot be issued in current status', 400);
  }

  if (!certificate.certificateNo) {
    throw new AppError('Certificate number must be generated before PDF creation', 400);
  }

  // Generate HTML based on certificate type
  let htmlContent;
  if (certificate.type === 'CLC') {
    htmlContent = generateCLCTemplate(certificate);
  } else if (certificate.type === 'BONAFIDE') {
    htmlContent = generateBonafideTemplate(certificate);
  } else if (certificate.type === 'CHARACTER') {
    htmlContent = generateCharacterTemplate(certificate);
  } else {
    throw new AppError('Invalid certificate type', 400);
  }

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '40px', right: '30px', bottom: '40px', left: '30px' }
  });

  await browser.close();

  // Save to temp directory
  const tempDir = path.join(__dirname, '../../temp/certificates');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, `certificate_${certificateId}.pdf`);
  fs.writeFileSync(filePath, pdfBuffer);

  // In production: upload to R2/cloud storage
  const pdfUrl = `/certificates/certificate_${certificateId}.pdf`;

  return { filePath, pdfUrl, buffer: pdfBuffer };
};

/**
 * CLC Certificate Template
 */
function generateCLCTemplate(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #000; padding-bottom: 20px; }
        .header h1 { font-size: 26px; margin: 0; color: #1a1a1a; }
        .header h2 { font-size: 18px; margin: 5px 0; color: #333; }
        .header h3 { font-size: 14px; margin: 5px 0; color: #666; }
        .certificate-no { text-align: right; margin-bottom: 30px; font-size: 14px; }
        .title { text-align: center; margin: 30px 0; font-size: 22px; font-weight: bold; text-decoration: underline; }
        .content { font-size: 15px; margin: 20px 0; text-align: justify; }
        .content p { margin: 10px 0; }
        .info-table { width: 100%; margin: 20px 0; }
        .info-table td { padding: 5px; vertical-align: top; }
        .info-label { font-weight: bold; width: 200px; }
        .signature { margin-top: 80px; text-align: right; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ccc; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SANT SANDHYADAS MAHILA COLLEGE</h1>
        <h2>Gulabbagh, Barh, Patna</h2>
        <h3>Affiliated to PPU, Patna | College Code: 435</h3>
      </div>
      
      <div class="certificate-no">
        <strong>Certificate No:</strong> ${data.certificateNo}
      </div>
      
      <div class="title">COLLEGE LEAVING CERTIFICATE</div>
      
      <div class="content">
        <p>This is to certify that <strong>${data.name}</strong>, 
        Daughter of <strong>${data.fatherName}</strong> and <strong>${data.motherName || 'N/A'}</strong>, 
        was a bonafide student of this institution.</p>
        
        <table class="info-table">
          <tr>
            <td class="info-label">University Roll No:</td>
            <td>${data.universityRoll || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Registration No:</td>
            <td>${data.registrationNo || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">College Roll No:</td>
            <td>${data.collegeRoll || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Course:</td>
            <td>${data.courseName}</td>
          </tr>
          <tr>
            <td class="info-label">Department:</td>
            <td>${data.departmentName}</td>
          </tr>
          <tr>
            <td class="info-label">Session:</td>
            <td>${data.session}</td>
          </tr>
          <tr>
            <td class="info-label">Semester:</td>
            <td>${data.semester}</td>
          </tr>
          ${data.dob ? `<tr><td class="info-label">Date of Birth:</td><td>${new Date(data.dob).toLocaleDateString('en-IN')}</td></tr>` : ''}
        </table>
        
        <p>She has completed the prescribed course of study and is leaving this college. 
        Her conduct and character during the period of study were satisfactory.</p>
      </div>
      
      <div class="signature">
        <p>__________________________</p>
        <p>Principal / Authorized Signatory</p>
        <p>Date: ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
      
      <div class="footer">
        <p>This is a computer-generated certificate | Generated on ${new Date().toLocaleString('en-IN')}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Bonafide Certificate Template
 */
function generateBonafideTemplate(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #000; padding-bottom: 20px; }
        .header h1 { font-size: 26px; margin: 0; color: #1a1a1a; }
        .header h2 { font-size: 18px; margin: 5px 0; color: #333; }
        .header h3 { font-size: 14px; margin: 5px 0; color: #666; }
        .certificate-no { text-align: right; margin-bottom: 30px; font-size: 14px; }
        .title { text-align: center; margin: 30px 0; font-size: 22px; font-weight: bold; text-decoration: underline; }
        .content { font-size: 15px; margin: 20px 0; text-align: justify; }
        .content p { margin: 10px 0; }
        .info-table { width: 100%; margin: 20px 0; }
        .info-table td { padding: 5px; vertical-align: top; }
        .info-label { font-weight: bold; width: 200px; }
        .signature { margin-top: 80px; text-align: right; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ccc; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SANT SANDHYADAS MAHILA COLLEGE</h1>
        <h2>Gulabbagh, Barh, Patna</h2>
        <h3>Affiliated to PPU, Patna | College Code: 435</h3>
      </div>
      
      <div class="certificate-no">
        <strong>Certificate No:</strong> ${data.certificateNo}
      </div>
      
      <div class="title">BONAFIDE CERTIFICATE</div>
      
      <div class="content">
        <p>This is to certify that <strong>${data.name}</strong>, 
        Daughter of <strong>${data.fatherName}</strong> and <strong>${data.motherName || 'N/A'}</strong>, 
        is a bonafide student of this institution.</p>
        
        <table class="info-table">
          <tr>
            <td class="info-label">University Roll No:</td>
            <td>${data.universityRoll || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Registration No:</td>
            <td>${data.registrationNo || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">College Roll No:</td>
            <td>${data.collegeRoll || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Course:</td>
            <td>${data.courseName}</td>
          </tr>
          <tr>
            <td class="info-label">Department:</td>
            <td>${data.departmentName}</td>
          </tr>
          <tr>
            <td class="info-label">Session:</td>
            <td>${data.session}</td>
          </tr>
          <tr>
            <td class="info-label">Semester:</td>
            <td>${data.semester}</td>
          </tr>
          ${data.dob ? `<tr><td class="info-label">Date of Birth:</td><td>${new Date(data.dob).toLocaleDateString('en-IN')}</td></tr>` : ''}
          ${data.purpose ? `<tr><td class="info-label">Purpose:</td><td>${data.purpose}</td></tr>` : ''}
        </table>
      </div>
      
      <div class="signature">
        <p>__________________________</p>
        <p>Principal / Authorized Signatory</p>
        <p>Date: ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
      
      <div class="footer">
        <p>This is a computer-generated certificate | Generated on ${new Date().toLocaleString('en-IN')}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Character Certificate Template
 */
function generateCharacterTemplate(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #000; padding-bottom: 20px; }
        .header h1 { font-size: 26px; margin: 0; color: #1a1a1a; }
        .header h2 { font-size: 18px; margin: 5px 0; color: #333; }
        .header h3 { font-size: 14px; margin: 5px 0; color: #666; }
        .certificate-no { text-align: right; margin-bottom: 30px; font-size: 14px; }
        .title { text-align: center; margin: 30px 0; font-size: 22px; font-weight: bold; text-decoration: underline; }
        .content { font-size: 15px; margin: 20px 0; text-align: justify; }
        .content p { margin: 10px 0; }
        .info-table { width: 100%; margin: 20px 0; }
        .info-table td { padding: 5px; vertical-align: top; }
        .info-label { font-weight: bold; width: 200px; }
        .signature { margin-top: 80px; text-align: right; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ccc; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SANT SANDHYADAS MAHILA COLLEGE</h1>
        <h2>Gulabbagh, Barh, Patna</h2>
        <h3>Affiliated to PPU, Patna | College Code: 435</h3>
      </div>
      
      <div class="certificate-no">
        <strong>Certificate No:</strong> ${data.certificateNo}
      </div>
      
      <div class="title">CHARACTER CERTIFICATE</div>
      
      <div class="content">
        <p>This is to certify that <strong>${data.name}</strong>, 
        Daughter of <strong>${data.fatherName}</strong> and <strong>${data.motherName || 'N/A'}</strong>, 
        is a bonafide student of this institution.</p>
        
        <table class="info-table">
          <tr>
            <td class="info-label">University Roll No:</td>
            <td>${data.universityRoll || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Registration No:</td>
            <td>${data.registrationNo || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">College Roll No:</td>
            <td>${data.collegeRoll || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Course:</td>
            <td>${data.courseName}</td>
          </tr>
          <tr>
            <td class="info-label">Department:</td>
            <td>${data.departmentName}</td>
          </tr>
          <tr>
            <td class="info-label">Session:</td>
            <td>${data.session}</td>
          </tr>
          ${data.dob ? `<tr><td class="info-label">Date of Birth:</td><td>${new Date(data.dob).toLocaleDateString('en-IN')}</td></tr>` : ''}
        </table>
        
        <p>Her character and conduct during the period of study in this institution 
        have been <strong>${data.character || 'satisfactory'}</strong>.</p>
      </div>
      
      <div class="signature">
        <p>__________________________</p>
        <p>Principal / Authorized Signatory</p>
        <p>Date: ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
      
      <div class="footer">
        <p>This is a computer-generated certificate | Generated on ${new Date().toLocaleString('en-IN')}</p>
      </div>
    </body>
    </html>
  `;
}
