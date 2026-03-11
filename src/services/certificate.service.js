const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { logAudit } = require('../utils/auditLogger');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * Generate a certificate PDF
 * @param {Object} certificateRequest - The certificate request object
 * @param {Object} student - The student object
 * @param {Object} department - The department object
 * @returns {Promise<String>} - Path to the generated PDF file
 */
exports.generateCertificatePDF = async (certificateRequest, student, department) => {
  try {
    // Create a document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Create a temporary file path
    const fileName = `certificate_${certificateRequest.id}_${Date.now()}.pdf`;
    const tempDir = path.join(__dirname, '../../temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, fileName);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Add certificate content
    doc.fontSize(20).text('COLLEGE CERTIFICATE', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).text(`This is to certify that`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(18).text(student.name, { align: 'center', underline: true });
    doc.moveDown(1);

    doc.fontSize(16).text(`Registration Number: ${student.reg_no}`, { align: 'center' });
    doc.moveDown(2);

    if (certificateRequest.type === 'BONAFIDE') {
      doc.fontSize(14).text(
        `is a bonafide student of our institution pursuing ${student.course?.name || 'their course'} ` +
        `in the ${department.name} department. This certificate is issued for the purpose of ${certificateRequest.purpose || 'general use'}.`,
        { align: 'center' }
      );
    } else if (certificateRequest.type === 'CLC') {
      doc.fontSize(14).text(
        `has completed the course curriculum and is eligible for the Character and Leaving Certificate. ` +
        `This certificate is issued for the purpose of ${certificateRequest.purpose || 'general use'}.`,
        { align: 'center' }
      );
    }

    doc.moveDown(3);

    // Add issue date
    const issueDate = new Date();
    doc.fontSize(14).text(`Issued on: ${issueDate.toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(2);

    // Add signature placeholder
    doc.fontSize(14).text('__________________________', { align: 'right' });
    doc.fontSize(14).text('Authorized Signatory', { align: 'right' });

    // Finalize PDF file
    doc.end();

    // Wait for the file to be written
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return filePath;
  } catch (error) {
    throw new AppError('Failed to generate certificate PDF', 500);
  }
};

/**
 * Issue a certificate and generate PDF
 * @param {String} certificateId - The certificate request ID
 * @param {Object} user - The user issuing the certificate
 * @returns {Promise<Object>} - Updated certificate with PDF URL
 */
exports.issueCertificate = async (certificateId, user) => {
  try {
    // Get certificate request with related data
    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id: certificateId },
      include: {
        student: {
          include: {
            course: true
          }
        },
        department: true
      }
    });

    if (!certificateRequest) {
      throw new AppError('Certificate request not found', 404);
    }

    // Check if certificate is already issued
    if (certificateRequest.status === 'ISSUED') {
      throw new AppError('Certificate already issued', 400);
    }

    // Check if certificate is approved
    if (certificateRequest.status !== 'APPROVED') {
      throw new AppError('Certificate must be approved before issuance', 400);
    }

    // Generate certificate PDF
    const pdfPath = await this.generateCertificatePDF(
      certificateRequest,
      certificateRequest.student,
      certificateRequest.department
    );

    // In a real implementation, you would upload this to Cloudflare R2
    // For now, we'll store the file path
    const pdfUrl = `/certificates/${path.basename(pdfPath)}`;

    // Update certificate request with PDF URL
    const updatedCertificate = await prisma.certificateRequest.update({
      where: { id: certificateId },
      data: {
        status: 'ISSUED',
        issuedAt: new Date(),
        pdfUrl,
        approvedById: user.id
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
            // university_roll: true  // TODO: Uncomment after running migration
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: user.id,
      action: 'ISSUE_CERTIFICATE',
      entity: 'CertificateRequest',
      entityId: certificateId,
      payload: { certificateType: certificateRequest.type },
      req: null // We don't have access to req here
    });

    return updatedCertificate;
  } catch (error) {
    throw error;
  }
};

/**
 * Get certificate PDF
 * @param {String} certificateId - The certificate request ID
 * @returns {Promise<Buffer>} - PDF file buffer
 */
exports.getCertificatePDF = async (certificateId) => {
  try {
    // Get certificate request
    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id: certificateId }
    });

    if (!certificateRequest) {
      throw new AppError('Certificate request not found', 404);
    }

    // Check if certificate is issued
    if (certificateRequest.status !== 'ISSUED') {
      throw new AppError('Certificate not yet issued', 400);
    }

    // Check if PDF URL exists
    if (!certificateRequest.pdfUrl) {
      throw new AppError('Certificate PDF not available', 404);
    }

    // Extract file name from URL
    const fileName = certificateRequest.pdfUrl.split('/').pop();
    const filePath = path.join(__dirname, '../../temp', fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new AppError('Certificate PDF file not found', 404);
    }

    // Read file and return buffer
    const fileBuffer = fs.readFileSync(filePath);
    return fileBuffer;
  } catch (error) {
    throw error;
  }
};