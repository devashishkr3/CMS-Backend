const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { logAudit } = require('../utils/auditLogger');
const { issueCertificate: issueCertificateService, getCertificatePDF } = require('../services/certificate.service');
const { 
  createCertificateRequest, 
  updateCertificateStatus, 
  filterCertificates 
} = require('../validation/certificate.validation');

/**
 * Create a new certificate request
 * Access: STUDENT, ADMIN, HOD
 */
exports.createCertificateRequest = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createCertificateRequest.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { studentId, type, purpose, departmentId } = value;

    // For STUDENT role, only allow creating requests for themselves
    if (req.user.role === 'STUDENT' && req.user.id !== studentId) {
      return next(new AppError('You can only create certificate requests for yourself', 403));
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }
    
    // Check if student is eligible for certificate based on status
    // Only students with ACTIVE, PASSED_OUT, or ALUMNI status can request certificates
    if (!['ACTIVE', 'PASSED_OUT', 'ALUMNI'].includes(student.status)) {
      return next(new AppError('Student is not eligible for certificate request', 400));
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });

    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    // Create certificate request
    const certificateRequest = await prisma.certificateRequest.create({
      data: {
        studentId,
        type,
        purpose: purpose || null,
        departmentId
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_CERTIFICATE_REQUEST',
      entity: 'CertificateRequest',
      entityId: certificateRequest.id,
      payload: { studentId, type, purpose, departmentId },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Certificate request created successfully',
      data: {
        certificateRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all certificate requests with filtering options
 * Access: ADMIN, HOD, STUDENT (own requests only)
 */
exports.getAllCertificateRequests = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = filterCertificates.validate(req.query);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { studentId, type, status, departmentId } = value;

    // Build where clause
    const where = {};

    // For STUDENT role, only allow accessing own requests
    if (req.user.role === 'STUDENT') {
      where.studentId = req.user.id;
    } else if (studentId) {
      where.studentId = studentId;
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Get certificate requests
    const certificateRequests = await prisma.certificateRequest.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: certificateRequests.length,
      data: {
        certificateRequests
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get certificate request by ID
 * Access: ADMIN, HOD, STUDENT (own requests only)
 */
exports.getCertificateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true,
            phone: true,
            address: true
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

    if (!certificateRequest) {
      return next(new AppError('Certificate request not found', 404));
    }

    // For STUDENT role, only allow accessing own requests
    if (req.user.role === 'STUDENT' && req.user.id !== certificateRequest.studentId) {
      return next(new AppError('You do not have permission to access this certificate request', 403));
    }

    res.status(200).json({
      status: 'success',
      data: {
        certificateRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update certificate request status (approve/reject/issue)
 * Access: ADMIN, HOD
 */
exports.updateCertificateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateCertificateStatus.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { status, notes } = value;

    // Get current certificate request
    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id }
    });

    if (!certificateRequest) {
      return next(new AppError('Certificate request not found', 404));
    }

    // Validate status transition
    const validTransitions = {
      'PENDING': ['APPROVED', 'REJECTED'],
      'APPROVED': ['ISSUED'],
      'REJECTED': [],
      'ISSUED': []
    };

    // Check if current status allows transition to new status
    const allowedTransitions = validTransitions[certificateRequest.status] || [];
    
    if (!allowedTransitions.includes(status)) {
      return next(new AppError(
        `Invalid status transition from ${certificateRequest.status} to ${status}`, 
        400
      ));
    }

    // REJECTED and ISSUED cannot be changed again
    if (['REJECTED', 'ISSUED'].includes(certificateRequest.status)) {
      return next(new AppError(`${certificateRequest.status} certificate requests cannot be modified`, 400));
    }

    // If status is ISSUED, check if student is eligible for certificate
    if (status === 'ISSUED') {
      // Get the student to verify their status
      const student = await prisma.student.findUnique({
        where: { id: certificateRequest.studentId }
      });
      
      if (!student) {
        return next(new AppError('Student not found for this certificate request', 404));
      }
      
      // Only students with ACTIVE, PASSED_OUT, or ALUMNI status can receive certificates
      if (!['ACTIVE', 'PASSED_OUT', 'ALUMNI'].includes(student.status)) {
        return next(new AppError('Student is not eligible to receive certificate', 400));
      }
    }
    
    // Update certificate request status
    const updatedCertificateRequest = await prisma.certificateRequest.update({
      where: { id },
      data: { 
        status,
        approvedById: req.user.id,
        issuedAt: status === 'ISSUED' ? new Date() : certificateRequest.issuedAt
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
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
      userId: req.user.id,
      action: 'UPDATE_CERTIFICATE_STATUS',
      entity: 'CertificateRequest',
      entityId: id,
      payload: { fromStatus: certificateRequest.status, toStatus: status, notes },
      req
    });

    res.status(200).json({
      status: 'success',
      message: `Certificate request ${status.toLowerCase()} successfully`,
      data: {
        certificateRequest: updatedCertificateRequest
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete certificate request
 * Access: ADMIN, STUDENT (own pending requests only)
 */
exports.deleteCertificateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get current certificate request
    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id }
    });

    if (!certificateRequest) {
      return next(new AppError('Certificate request not found', 404));
    }

    // For STUDENT role, only allow deleting own pending requests
    if (req.user.role === 'STUDENT') {
      if (req.user.id !== certificateRequest.studentId) {
        return next(new AppError('You can only delete your own certificate requests', 403));
      }
      
      if (certificateRequest.status !== 'PENDING') {
        return next(new AppError('Only pending certificate requests can be deleted', 400));
      }
    }

    // Delete certificate request
    await prisma.certificateRequest.delete({
      where: { id }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_CERTIFICATE_REQUEST',
      entity: 'CertificateRequest',
      entityId: id,
      payload: { type: certificateRequest.type },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Certificate request deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Issue certificate and generate PDF
 * Access: ADMIN, HOD
 */
exports.issueCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Issue certificate and generate PDF
    const certificate = await issueCertificateService(id, req.user);

    res.status(200).json({
      status: 'success',
      message: 'Certificate issued successfully',
      data: {
        certificate
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download certificate PDF
 * Access: STUDENT (own certificates), ADMIN, HOD
 */
exports.downloadCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get certificate request
    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id }
    });

    if (!certificateRequest) {
      return next(new AppError('Certificate request not found', 404));
    }

    // For STUDENT role, only allow accessing own certificates
    if (req.user.role === 'STUDENT' && req.user.id !== certificateRequest.studentId) {
      return next(new AppError('You do not have permission to access this certificate', 403));
    }

    // Check if certificate is issued
    if (certificateRequest.status !== 'ISSUED') {
      return next(new AppError('Certificate not yet issued', 400));
    }

    // Get certificate PDF
    const pdfBuffer = await getCertificatePDF(id);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate_${id}.pdf"`);
    
    // Send PDF buffer
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};