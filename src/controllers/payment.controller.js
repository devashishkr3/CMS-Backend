const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { 
  createPayment, 
  updatePaymentStatus, 
  refundPayment 
} = require('../validation/payment.validation');
const axios = require("axios");
const GcmPgEncryption = require("../utils/getepayEncrypt");
const { generateReceiptAndCertificate } = require("./receipt.controller");

/**
 * Create a new payment
 * Access: ADMIN, ACCOUNTANT
 */
exports.createPayment = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createPayment.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { studentId, admissionId, totalAmount, gateway, txnId, referenceNo, breakups } = value;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Check if admission exists (if provided)
    let admission = null;
    if (admissionId) {
      admission = await prisma.admission.findUnique({
        where: { id: admissionId }
      });

      if (!admission) {
        return next(new AppError('Admission not found', 404));
      }

      // Verify that admission belongs to the student
      if (admission.studentId !== studentId) {
        return next(new AppError('Admission does not belong to the specified student', 400));
      }
    }

    // Check if transaction ID already exists
    const existingPayment = await prisma.payment.findUnique({
      where: { txnId }
    });

    if (existingPayment) {
      return next(new AppError('Payment with this transaction ID already exists', 400));
    }

    // Generate receipt number
    const receiptNo = `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create payment in a transaction
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          studentId,
          admissionId: admissionId || null,
          totalAmount,
          status: 'INITIATED',
          gateway,
          txnId,
          referenceNo: referenceNo || null,
          receiptNo
        }
      });

      // Create payment breakups if provided
      if (breakups && breakups.length > 0) {
        const breakupData = breakups.map(breakup => ({
          paymentId: newPayment.id,
          head: breakup.head,
          amount: breakup.amount
        }));

        await tx.paymentBreakup.createMany({
          data: breakupData
        });
      }

      return newPayment;
    });

    // Fetch complete payment with breakups
    const completePayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true
          }
        },
        admission: {
          select: {
            id: true,
            status: true
          }
        },
        breakups: true
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        payload: JSON.stringify({ studentId, admissionId, totalAmount, gateway, txnId })
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Payment initiated successfully',
      data: {
        payment: completePayment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payments with filtering options
 * Access: ADMIN, ACCOUNTANT, HOD
 */
exports.getAllPayments = async (req, res, next) => {
  try {
    const { status, studentId, admissionId } = req.query;
    
    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (studentId) {
      where.studentId = studentId;
    }
    
    if (admissionId) {
      where.admissionId = admissionId;
    }

    // Get payments
    const payments = await prisma.payment.findMany({
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
        admission: {
          select: {
            id: true,
            status: true
          }
        },
        breakups: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: {
        payments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment by ID
 * Access: ADMIN, ACCOUNTANT, HOD
 */
exports.getPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
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
        admission: {
          select: {
            id: true,
            status: true
          }
        },
        breakups: true
      }
    });

    if (!payment) {
      return next(new AppError('Payment not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        payment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update payment status
 * Access: ADMIN, ACCOUNTANT
 */
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updatePaymentStatus.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { status, notes } = value;

    // Get current payment
    const payment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!payment) {
      return next(new AppError('Payment not found', 404));
    }

    // Validate status transition
    const validTransitions = {
      'INITIATED': ['SUCCESS', 'FAILED'],
      'SUCCESS': ['REFUNDED'],
      'FAILED': [],
      'REFUNDED': []
    };

    // Check if current status allows transition to new status
    const allowedTransitions = validTransitions[payment.status] || [];
    
    if (!allowedTransitions.includes(status)) {
      return next(new AppError(
        `Invalid status transition from ${payment.status} to ${status}`, 
        400
      ));
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { 
        status
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
        admission: {
          select: {
            id: true,
            status: true
          }
        },
        breakups: true
      }
    });

    // If payment is successful and linked to an admission, update admission status
    if (status === 'SUCCESS' && payment.admissionId) {
      await prisma.admission.update({
        where: { id: payment.admissionId },
        data: { status: 'CONFIRMED' }
      });
    }

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_PAYMENT_STATUS',
        entity: 'Payment',
        entityId: id,
        payload: JSON.stringify({ fromStatus: payment.status, toStatus: status, notes })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment status updated successfully',
      data: {
        payment: updatedPayment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refund a payment
 * Access: ADMIN, ACCOUNTANT
 */
exports.refundPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = refundPayment.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { reason, refundAmount } = value;

    // Get current payment
    const payment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!payment) {
      return next(new AppError('Payment not found', 404));
    }

    // Check if payment can be refunded
    if (payment.status !== 'SUCCESS') {
      return next(new AppError('Only successful payments can be refunded', 400));
    }

    // Check if payment is already refunded
    if (payment.status === 'REFUNDED') {
      return next(new AppError('Payment is already refunded', 400));
    }

    // Update payment status to REFUNDED
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { 
        status: 'REFUNDED'
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
        admission: {
          select: {
            id: true,
            status: true
          }
        },
        breakups: true
      }
    });

    // Create refund record (in a real implementation, this would integrate with payment gateway)
    const refund = await prisma.$transaction(async (tx) => {
      // Create refund record
      const refundRecord = await tx.refund.create({
        data: {
          paymentId: id,
          amount: refundAmount || payment.totalAmount,
          reason,
          refundedById: req.user.id,
          refundedAt: new Date()
        }
      });

      return refundRecord;
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'REFUND_PAYMENT',
        entity: 'Payment',
        entityId: id,
        payload: JSON.stringify({ refundAmount: refundAmount || payment.totalAmount, reason })
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment refunded successfully',
      data: {
        payment: updatedPayment,
        refund
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment statistics
 * Access: ADMIN, ACCOUNTANT, HOD
 */
exports.getPaymentStats = async (req, res, next) => {
  try {
    // Get payment statistics
    const stats = await prisma.payment.groupBy({
      by: ['status'],
      _sum: {
        totalAmount: true
      },
      _count: true
    });

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      take: 10,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        stats,
        recentPayments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * STEP 1: Generate Payment Link
 */
exports.generatePaymentLink = async (req, res, next) => {
  const { paymentId } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: true }
  });

  if (!payment) return next(new AppError("Payment not found", 404));

  const payload = {
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    amount: payment.totalAmount.toFixed(2),
    merchantTransactionId: payment.txnId,
    transactionDate: new Date().toISOString(),
    ru: process.env.GETEPAY_RETURN_URL,
    callbackUrl: process.env.GETEPAY_CALLBACK_URL,
    currency: "INR",
    paymentMode: "ALL",
    udf1: payment.student.phone,
    udf2: payment.student.email,
    udf3: payment.student.name
  };

  const enc = new GcmPgEncryption(
    process.env.GETEPAY_IV,
    process.env.GETEPAY_KEY
  );

  const encrypted = await enc.encrypt(JSON.stringify(payload));

  const response = await axios.post(process.env.GETEPAY_URL, {
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    req: encrypted
  });

  const decrypted = JSON.parse(await enc.decrypt(response.data.response));

  res.json({
    status: "success",
    paymentUrl: decrypted.paymentUrl
  });
};

/**
 * STEP 2: Return URL (Browser Redirect)
 */
exports.paymentReturn = async (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/payment-processing`);
};

/**
 * STEP 3: Callback URL (SERVER → SERVER)
 */
exports.paymentCallback = async (req, res) => {
  const enc = new GcmPgEncryption(
    process.env.GETEPAY_IV,
    process.env.GETEPAY_KEY
  );

  const decrypted = JSON.parse(await enc.decrypt(req.body.response));

  const payment = await prisma.payment.findUnique({
    where: { txnId: decrypted.merchantTransactionId }
  });

  if (!payment) return res.sendStatus(400);

  if (decrypted.paymentStatus === "SUCCESS") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS" }
    });

    await generateReceiptAndCertificate(payment.id);
  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" }
    });
  }

  res.sendStatus(200);
};