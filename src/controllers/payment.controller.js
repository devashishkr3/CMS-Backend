const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { generatePaymentCSV, generateSummaryCSV } = require('../utils/dcr1ReportGenerator');
const { 
  createPayment, 
  updatePaymentStatus, 
  refundPayment 
} = require('../validation/payment.validation');
const axios = require("axios");
const fs = require("fs");
const GcmPgEncryption = require("../utils/getepayEncrypt");
const { generateReceiptAndCertificate } = require("./receipt.controller");
const { generateReceiptPDF } = require("../utils/pdfGenerator");

const GATEWAY_SUCCESS = "SUCCESS";
const GATEWAY_FAILED = "FAILED";

const normalizeTxnStatus = (status) => {
  if (!status) return "";
  return String(status).trim().toUpperCase();
};

const normalizeEncryptedResponse = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  // Gateways sometimes post form-urlencoded where '+' becomes space.
  return raw.includes(" ") ? raw.replace(/ /g, "+") : raw;
};

const getEncryptedGatewayResponse = (req) => {
  return normalizeEncryptedResponse(
    req.body?.response ||
    req.body?.resp ||
    req.query?.response ||
    req.query?.resp ||
    null
  );
};

const parseGatewayResponseFields = (decrypted) => {
  return {
    merchantTxnId:
      decrypted.merchantOrderNo ||
      decrypted.merchantTransactionId ||
      decrypted.merchantTxnId ||
      null,
    txnStatus: normalizeTxnStatus(
      decrypted.txnStatus ||
      decrypted.paymentStatus ||
      decrypted.status
    ),
    getepayTxnId:
      decrypted.getepayTxnId ||
      decrypted.bankTxnNo ||
      decrypted.referenceNo ||
      null,
    paymentMode: decrypted.paymentMode || null,
    txnDate: decrypted.txnDate || null,
    txnAmount: decrypted.txnAmount || decrypted.totalAmount || null,
    errorMessage: decrypted.message || decrypted.errorMessage || null
  };
};

const isUsableAbsoluteUrl = (value) => {
  if (!value || value === "*" || value === "undefined" || value === "null") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getPrimaryFrontendBase = () => {
  const raw = String(process.env.FRONTEND_URL || "").trim();
  const candidates = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const usable = candidates.find(isUsableAbsoluteUrl);
  return usable || "http://localhost:5173";
};

const getBackendPublicBase = (req) => {
  const configured = String(process.env.BACKEND_PUBLIC_URL || "").trim();
  if (isUsableAbsoluteUrl(configured)) {
    return configured.replace(/\/+$/, "");
  }

  if (req?.protocol && req?.get) {
    return `${req.protocol}://${req.get("host")}`;
  }

  return "http://localhost:8080";
};

const buildGatewayReturnOrCallbackUrl = (req, type, paymentId) => {
  const envKey = type === "callback" ? "GETEPAY_CALLBACK_URL" : "GETEPAY_RETURN_URL";
  const configured = String(process.env[envKey] || "").trim();
  const base =
    isUsableAbsoluteUrl(configured)
      ? configured
      : `${getBackendPublicBase(req)}/api/v1/payments/${type === "callback" ? "callback" : "return"}`;

  const url = new URL(base);
  if (paymentId) {
    url.searchParams.set("paymentId", paymentId);
  }
  return url.toString();
};

const buildProcessingRedirectUrl = (paymentId, extraQuery = {}) => {
  const frontendBase = getPrimaryFrontendBase();
  const hasProcessingPath = /\/payment-processing\/?$/.test(frontendBase);
  const redirectBase = hasProcessingPath
    ? frontendBase
    : `${frontendBase.replace(/\/+$/, "")}/payment-processing`;

  const redirectUrl = new URL(redirectBase);

  if (paymentId) {
    redirectUrl.searchParams.set("paymentId", paymentId);
  }

  Object.entries(extraQuery).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      redirectUrl.searchParams.set(key, String(value));
    }
  });

  return redirectUrl.toString();
};

const parseCurrencyAmount = (value) => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
};

const isAmountMismatch = (expected, received, tolerance = 0.01) => {
  if (!Number.isFinite(expected) || !Number.isFinite(received)) return false;
  return Math.abs(expected - received) > tolerance;
};

const statusPriority = {
  PENDING: 0,
  INITIATED: 1,
  FAILED: 2,
  SUCCESS: 3,
  REFUNDED: 4
};

const shouldApplyStatusUpdate = (currentStatus, nextStatus) => {
  const current = statusPriority[currentStatus] ?? -1;
  const next = statusPriority[nextStatus] ?? -1;
  return next >= current;
};

const resolveInternalPaymentStatus = (gatewayStatus) => {
  if (gatewayStatus === GATEWAY_SUCCESS) return "SUCCESS";
  if (gatewayStatus === GATEWAY_FAILED) return "FAILED";
  return "PENDING";
};

const isGatewayIdentityValid = (decrypted) => {
  const configuredMid = String(process.env.GETEPAY_MID || "").trim();
  const configuredTerminal = String(process.env.GETEPAY_TERMINAL_ID || "").trim();

  const responseMid = decrypted?.mid || decrypted?.merchantId || decrypted?.merchantCode || "";
  const responseTerminal = decrypted?.terminalId || decrypted?.terminal || "";

  const midMatches = !responseMid || !configuredMid || String(responseMid).trim() === configuredMid;
  const terminalMatches =
    !responseTerminal || !configuredTerminal || String(responseTerminal).trim() === configuredTerminal;

  return midMatches && terminalMatches;
};

const triggerReceiptGenerationAsync = (paymentId, source) => {
  setImmediate(async () => {
    try {
      // console.log(`📄 [${source}] Async receipt/certificate generation started for ${paymentId}`);
      await generateReceiptAndCertificate(paymentId);
      // console.log(`✅ [${source}] Async receipt/certificate generation completed for ${paymentId}`);
    } catch (err) {
      console.warn(`⚠️  [${source}] Async receipt/certificate generation failed:`, err.message);
    }
  });
};

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

    // For testing: return mock payment if database unavailable
    try {
      // Check if student exists
      const student = await prisma.student.findUnique({
        where: { id: studentId }
      });

      if (!student) {
        return next(new AppError('Student not found', 404));
      }
    } catch (dbError) {
      // console.warn('⚠️  Database unavailable, using mock data for testing');
      
      // Return mock payment for testing
      const mockPayment = {
        id: `mock-${Date.now()}`,
        studentId,
        totalAmount,
        status: 'INITIATED',
        gateway: 'GETEPAY',
        txnId,
        receiptNo: `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        student: {
          id: studentId,
          name: 'Test Student',
          email: 'test@example.com',
          reg_no: 'TEST-001'
        },
        breakups: breakups || [{ head: 'TUITION', amount: totalAmount }]
      };
      
      return res.status(201).json({
        status: 'success',
        message: 'Payment initiated successfully (MOCK MODE)',
        data: { payment: mockPayment }
      });
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

      const existingSuccessfulPayment = await prisma.payment.findFirst({
        where: {
          studentId,
          admissionId,
          status: 'SUCCESS'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          status: true,
          receiptNo: true,
          totalAmount: true,
          createdAt: true
        }
      });

      if (existingSuccessfulPayment) {
        return res.status(409).json({
          status: 'error',
          message: 'Admission fee has already been paid for this admission.',
          data: {
            payment: existingSuccessfulPayment
          }
        });
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
            reg_no: true,
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

    // Log audit entry (only if user is authenticated)
    if (req.user && req.user.id) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_PAYMENT',
          entity: 'Payment',
          entityId: payment.id,
          payload: JSON.stringify({ studentId, admissionId, totalAmount, gateway, txnId })
        }
      });
    }

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
            reg_no: true,
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
            reg_no: true,
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

    if (payment.status === "SUCCESS") {
      payment.invoiceUrl = payment.receiptUrl || `${getBackendPublicBase(req)}/api/v1/payments/public/${payment.id}/invoice`;
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
 * Download/preview invoice PDF (public)
 * Access: Public by payment id (UUID); only for SUCCESS payments
 */
exports.downloadPublicInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        student: true,
        breakups: true
      }
    });

    if (!payment) {
      return next(new AppError("Payment not found", 404));
    }

    if (payment.status !== "SUCCESS") {
      return next(new AppError("Invoice available only for successful payments", 400));
    }

    // Fast path: if receipt was already uploaded, redirect to persisted file.
    if (payment.receiptUrl) {
      return res.redirect(payment.receiptUrl);
    }

    const receiptPath = await generateReceiptPDF(payment);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${payment.receiptNo}.pdf"`);

    const stream = fs.createReadStream(receiptPath);
    stream.on("error", (err) => next(err));
    stream.on("close", () => {
      fs.promises.unlink(receiptPath).catch(() => {});
    });
    stream.pipe(res);
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
            reg_no: true,
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
            reg_no: true,
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
 * Get DCR1 - Daily Collection Report
 * Returns:
 * - Total admission payment collection (all-time)
 * - This month's admission payment collection
 * - Today's admission payment collection
 * 
 * Access: ADMIN, ACCOUNTANT
 */
exports.getDCR1Report = async (req, res, next) => {
  try {
    const now = new Date();
    
    // Start of today (midnight)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Start of this month (1st day at midnight)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // End of today (just before midnight)
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    
    // Get total successful payment collection (all-time)
    const totalCollection = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    });
    
    // Get this month's successful payment collection
    const monthCollection = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: startOfMonth,
          lt: endOfToday // Up to now
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    });
    
    // Get today's successful payment collection
    const todayCollection = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: startOfToday,
          lt: endOfToday
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    });
    
    // Get detailed breakdown for today's collections
    const todayPaymentsDetail = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: startOfToday,
          lt: endOfToday
        }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true,
            email: true,
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        admission: {
          select: {
            id: true,
            admissionNo: true,
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        breakups: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Get detailed breakdown for this month's collections
    const monthPaymentsDetail = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: startOfMonth,
          lt: endOfToday
        }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true,
            email: true,
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        admission: {
          select: {
            id: true,
            admissionNo: true,
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        breakups: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to recent 100 transactions for performance
    });
    
    // Format the report
    const dcr1Report = {
      reportDate: now.toISOString(),
      reportType: 'DCR1 - Daily Collection Report',
      summary: {
        totalCollection: {
          amount: totalCollection._sum.totalAmount || 0,
          count: totalCollection._count || 0,
          period: 'All Time'
        },
        monthCollection: {
          amount: monthCollection._sum.totalAmount || 0,
          count: monthCollection._count || 0,
          period: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
          startDate: startOfMonth.toISOString(),
          endDate: now.toISOString()
        },
        todayCollection: {
          amount: todayCollection._sum.totalAmount || 0,
          count: todayCollection._count || 0,
          period: 'Today',
          date: startOfToday.toISOString()
        }
      },
      details: {
        todayPayments: todayPaymentsDetail,
        monthPayments: monthPaymentsDetail
      }
    };
    
    res.status(200).json({
      status: 'success',
      message: 'DCR1 report generated successfully',
      data: {
        report: dcr1Report
      }
    });
    
  } catch (error) {
    console.error('Error generating DCR1 report:', error.message);
    next(error);
  }
};

/**
 * Get DCR1 Report with Date Range Filter
 * Returns:
 * - Total collection within date range
 * - Transaction details within date range
 * - CSV export option
 * - Summary statistics
 * 
 * Query Params:
 * - startDate: Start date (ISO format: YYYY-MM-DD)
 * - endDate: End date (ISO format: YYYY-MM-DD)
 * - format: 'json' or 'csv' (default: 'json')
 * 
 * Access: ADMIN, ACCOUNTANT
 */
exports.getDCR1ReportWithDateRange = async (req, res, next) => {
  try {
    const { startDate, endDate, format } = req.query;
    
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set start to beginning of day
    start.setHours(0, 0, 0, 0);
    
    // Set end to end of day
    end.setHours(23, 59, 59, 999);
    
    // Validate date range
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('Invalid date format. Use ISO format (YYYY-MM-DD)', 400));
    }
    
    if (start > end) {
      return next(new AppError('Start date cannot be after end date', 400));
    }
    
    // Limit range to max 1 year for performance
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 365) {
      return next(new AppError('Date range cannot exceed 365 days', 400));
    }
    
    // Get total collection within date range
    const rangeCollection = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    });
    
    // Get all detailed transactions within date range
    const paymentsDetail = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true,
            email: true
          }
        },
        admission: {
          select: {
            id: true,
            admissionNo: true,
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        breakups: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Calculate summary
    const totalAmount = rangeCollection._sum.totalAmount || 0;
    const totalCount = rangeCollection._count || 0;
    const averageAmount = totalCount > 0 ? (totalAmount / totalCount) : 0;
    
    // Prepare summary object
    const summary = {
      totalCollection: {
        amount: Number(totalAmount),
        count: totalCount,
        period: `${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`,
        startDate: start.toISOString(),
        endDate: end.toISOString()
      },
      averageTransaction: {
        amount: Number(averageAmount.toFixed(2)),
        description: 'Average per transaction'
      }
    };
    
    // If CSV format requested
    if (format === 'csv') {
      const { csvData, fileName } = generatePaymentCSV(paymentsDetail);
      
      // Add summary at the end of CSV
      const summaryCSV = generateSummaryCSV(summary, start, end);
      const finalCSV = csvData + '\n\n' + summaryCSV;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      return res.send(finalCSV);
    }
    
    // Format the JSON report
    const dcr1Report = {
      reportType: 'DCR1 - Date Range Collection Report',
      generatedAt: new Date().toISOString(),
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        formattedRange: `${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`,
        totalDays: diffDays
      },
      summary: summary,
      statistics: {
        totalTransactions: totalCount,
        successfulAmount: Number(totalAmount),
        averageTransactionValue: Number(averageAmount.toFixed(2)),
        highestTransaction: paymentsDetail.length > 0 
          ? Math.max(...paymentsDetail.map(p => Number(p.totalAmount))) 
          : 0,
        lowestTransaction: paymentsDetail.length > 0 
          ? Math.min(...paymentsDetail.map(p => Number(p.totalAmount))) 
          : 0
      },
      transactions: paymentsDetail,
      downloadLinks: {
        csv: `/api/v1/payments/dcr1-report/date-range?startDate=${startDate}&endDate=${endDate}&format=csv`
      }
    };
    
    res.status(200).json({
      status: 'success',
      message: `DCR1 report generated for ${diffDays + 1} days`,
      data: {
        report: dcr1Report
      }
    });
    
  } catch (error) {
    console.error('Error generating DCR1 date range report:', error.message);
    next(error);
  }
};

/**
 * Get Today's Collection Summary
 * Quick endpoint for today's collection only
 * Access: ADMIN, ACCOUNTANT
 */
exports.getTodayCollection = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    
    const todayCollection = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: startOfToday,
          lt: endOfToday
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        today: {
          amount: Number(todayCollection._sum.totalAmount || 0),
          count: todayCollection._count || 0,
          date: startOfToday.toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Month's Collection Summary
 * Quick endpoint for current month's collection only
 * Access: ADMIN, ACCOUNTANT
 */
exports.getMonthCollection = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const monthCollection = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        month: {
          amount: Number(monthCollection._sum.totalAmount || 0),
          count: monthCollection._count || 0,
          startDate: startOfMonth.toISOString(),
          endDate: endOfMonth.toISOString(),
          monthName: now.toLocaleString('default', { month: 'long' }),
          year: now.getFullYear()
        }
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
            reg_no: true,
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
 * STEP 1: Generate Payment Link via GetEpay Gateway
 * Access: ADMIN, ACCOUNTANT
 */
exports.generatePaymentLink = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    console.log(`🔗 Generating payment link for payment: ${paymentId}`);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: true }
    });

    if (!payment) {
      console.error(`❌ Payment not found: ${paymentId}`);
      return next(new AppError("Payment not found", 404));
    }

    // console.log(`✅ Payment found: ${payment.receiptNo}, Amount: ${payment.totalAmount}`);

    // Build GetEpay payload
    const returnUrl = buildGatewayReturnOrCallbackUrl(req, "return", payment.id);
    const callbackUrl = buildGatewayReturnOrCallbackUrl(req, "callback", payment.id);

    const payload = {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      amount: payment.totalAmount.toString(),
      merchantTransactionId: payment.txnId,
      transactionDate: new Date().toISOString(),
      ru: returnUrl,
      callbackUrl: callbackUrl,
      currency: "INR",
      paymentMode: "ALL",
      bankId: "455",
      txnType: "single",
      productType: "IPG",
      txnNote: `Payment for ${payment.student.name} - ${payment.receiptNo}`,
      udf1: payment.student.phone || "",
      udf2: payment.student.email || "",
      udf3: payment.student.name || "",
      udf4: "",
      udf5: "",
      udf6: "",
      udf7: "",
      udf8: "",
      udf9: "",
      udf10: ""
    };

    // console.log(`📦 Payload created, amount: ${payload.amount}`);

    // Initialize encryption
    // console.log(`🔑 IV: ${process.env.GETEPAY_IV ? 'Set' : 'NULL'}`);
    // console.log(`🔑 KEY: ${process.env.GETEPAY_KEY ? 'Set' : 'NULL'}`);

    const enc = new GcmPgEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY
    );

    // console.log(`🔐 Encrypting payload...`);
    const encrypted = await enc.encrypt(JSON.stringify(payload));
    // console.log(`✅ Encrypted successfully, length: ${encrypted.length}`);

    // Call GetEpay API
    // console.log(`🚀 Calling GetEpay API at: ${process.env.GETEPAY_URL}`);
    // console.log(`📤 Request data:`, {
    //   mid: process.env.GETEPAY_MID,
    //   terminalId: process.env.GETEPAY_TERMINAL_ID,
    //   req: encrypted.substring(0, 50) + '...' // Show first 50 chars
    // });

    let response;
    try {
      response = await axios.post(process.env.GETEPAY_URL, {
        mid: process.env.GETEPAY_MID,
        terminalId: process.env.GETEPAY_TERMINAL_ID,
        req: encrypted
      }, {
        timeout: 30000 // 30 second timeout
      });
    } catch (axiosError) {
      console.error('❌ GetEpay API Error:', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message
      });
      throw new AppError(`GetEpay API error: ${axiosError.message}`, 502);
    }

    // console.log(`✅ GetEpay API response status: ${response.status}`);
    // console.log(`📥 Full Response object keys:`, Object.keys(response.data));
    // console.log(`📥 Complete Response data:`, JSON.stringify(response.data, null, 2));

    // Check if GetEpay returned an error
    if (response.data.status === 'FAILED') {
      console.error('❌ GetEpay Error:', response.data.message);
      throw new AppError(`GetEpay Error: ${response.data.message}`, 502);
    }

    // Check if response has the expected structure
    if (!response.data) {
      console.error('❌ GetEpay response is empty');
      throw new AppError('GetEpay returned empty response', 502);
    }

    // console.log(`🔍 Checking for response field...`);
    // console.log(`   response.data.response exists?`, !!response.data.response);
    // console.log(`   response.data.resp exists?`, !!response.data.resp);
    // console.log(`   response.data.paymentUrl exists?`, !!response.data.paymentUrl);
    // console.log(`   All data keys:`, Object.keys(response.data));

    if (!response.data.response) {
      console.error('❌ GetEpay response.data.response is missing');
      console.error('Available fields:', Object.keys(response.data));
      throw new AppError('GetEpay response format invalid - no encrypted response data', 502);
    }

    // Decrypt response
    // console.log(`🔓 Decrypting response...`);
    let decrypted;
    try {
      const decryptedStr = await enc.decrypt(response.data.response);
      if (!decryptedStr) {
        throw new Error('Decryption returned empty string');
      }
      decrypted = JSON.parse(decryptedStr);
    } catch (decryptError) {
      console.error('❌ Decryption error:', decryptError.message);
      throw new AppError(`Decryption failed: ${decryptError.message}`, 502);
    }
    // console.log(`✅ Decrypted response:`, decrypted);

    // Update payment with gateway reference
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        gateway: "GETEPAY",
        status: "INITIATED"
      }
    });

    // Log audit entry (only if user is authenticated)
    if (req.user && req.user.id) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'GENERATE_PAYMENT_LINK',
          entity: 'Payment',
          entityId: paymentId,
          payload: JSON.stringify({ amount: payment.totalAmount, gateway: 'GETEPAY' })
        }
      });
    }

    // console.log(`✅ Payment link generated successfully`);

    res.status(200).json({
      status: "success",
      message: "Payment link generated successfully",
      data: {
        paymentUrl: decrypted.paymentUrl,
        paymentId: payment.id
      }
    });
  } catch (error) {
    console.error('❌ Error in generatePaymentLink:', error.message);
    console.error('❌ Stack trace:', error.stack);
    next(error);
  }
};

/**
 * STEP 1B: Generate Payment Link for Students (Student Initiated)
 * Access: STUDENT (via token)
 */
exports.studentGeneratePaymentLink = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: true }
    });

    if (!payment) return next(new AppError("Payment not found", 404));

    // Verify payment belongs to student
    if (payment.studentId !== req.user.id) {
      return next(new AppError("Unauthorized: Payment does not belong to this student", 403));
    }

    // Build GetEpay payload
    const returnUrl = buildGatewayReturnOrCallbackUrl(req, "return", payment.id);
    const callbackUrl = buildGatewayReturnOrCallbackUrl(req, "callback", payment.id);

    const payload = {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      amount: payment.totalAmount.toString(),
      merchantTransactionId: payment.txnId,
      transactionDate: new Date().toISOString(),
      ru: returnUrl,
      callbackUrl: callbackUrl,
      currency: "INR",
      paymentMode: "ALL",
      bankId: "455",
      txnType: "single",
      productType: "IPG",
      txnNote: `Payment for ${payment.student.name} - ${payment.receiptNo}`,
      udf1: payment.student.phone || "",
      udf2: payment.student.email || "",
      udf3: payment.student.name || "",
      udf4: "",
      udf5: "",
      udf6: "",
      udf7: "",
      udf8: "",
      udf9: "",
      udf10: ""
    };

    // Initialize encryption
    const enc = new GcmPgEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY
    );

    const encrypted = await enc.encrypt(JSON.stringify(payload));

    // Call GetEpay API
    const response = await axios.post(process.env.GETEPAY_URL, {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      req: encrypted
    });

    // Decrypt response
    const decrypted = JSON.parse(await enc.decrypt(response.data.response));

    // Update payment with gateway reference
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        gateway: "GETEPAY",
        status: "INITIATED"
      }
    });

    res.status(200).json({
      status: "success",
      message: "Payment link generated successfully",
      data: {
        paymentUrl: decrypted.paymentUrl,
        paymentId: payment.id,
        amount: payment.totalAmount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * STEP 2: Return URL (Browser Redirect after Payment)
 * This endpoint is called by GetEpay when user completes/cancels payment
 * GetEpay sends encrypted response in req.body.response
 */
exports.paymentReturn = async (req, res, next) => {
  try {
    // console.log('\n' + '='.repeat(80));
    // console.log('🔄 [RETURN] ===== PAYMENT RETURN RECEIVED =====');
    // console.log('='.repeat(80));
    
    let paymentId = req.query.paymentId;
    let txnStatus = "INITIATED";
    let getepayTxnId = null;
    let txnAmount = null;

    // Get encrypted response from GetEpay
    const encryptedResponse = getEncryptedGatewayResponse(req);
    // console.log('📦 [RETURN] Encrypted response present?', !!encryptedResponse);

    // Decrypt the response if available
    if (encryptedResponse) {
      try {
        const enc = new GcmPgEncryption(
          process.env.GETEPAY_IV,
          process.env.GETEPAY_KEY
        );

        // console.log('🔐 [RETURN] Decrypting response...');
        const decryptedData = await enc.decrypt(encryptedResponse);
        const decrypted = JSON.parse(decryptedData);
        
        // console.log('✅ [RETURN] Decryption successful');
        // console.log('📋 [RETURN] Decrypted data:', JSON.stringify(decrypted, null, 2));

        if (!isGatewayIdentityValid(decrypted)) {
          console.error("❌ [RETURN] Gateway identity check failed");
          return res.redirect(buildProcessingRedirectUrl(null, { error: "invalid_gateway_identity" }));
        }

        // Extract payment details from decrypted response
        const parsedResponse = parseGatewayResponseFields(decrypted);
        txnStatus = parsedResponse.txnStatus || "INITIATED";
        getepayTxnId = parsedResponse.getepayTxnId;
        txnAmount = parseCurrencyAmount(parsedResponse.txnAmount);
        
        // If paymentId not in query, try to get it from merchantOrderNo (txnId)
        if (!paymentId && decrypted.merchantOrderNo) {
          const payment = await prisma.payment.findUnique({
            where: { txnId: decrypted.merchantOrderNo },
            select: { id: true }
          });
          if (payment) {
            paymentId = payment.id;
            // console.log('✅ [RETURN] Found payment by merchantOrderNo:', paymentId);
          }
        }
      } catch (decryptError) {
        console.warn("⚠️  [RETURN] Decryption failed:", decryptError.message);
      }
    }

    // Update payment status in database
    if (paymentId && (txnStatus === GATEWAY_SUCCESS || txnStatus === GATEWAY_FAILED)) {
      try {
        // console.log(`📝 [RETURN] Updating payment ${paymentId} to status: ${txnStatus}`);
        
        const payment = await prisma.payment.findUnique({
          where: { id: paymentId },
          select: { id: true, status: true, totalAmount: true, admissionId: true, receiptUrl: true }
        });

        if (payment) {
          const nextStatus = resolveInternalPaymentStatus(txnStatus);
          const expectedAmount = parseCurrencyAmount(payment.totalAmount);

          if (isAmountMismatch(expectedAmount, txnAmount)) {
            console.error(
              `❌ [RETURN] Amount mismatch. expected=${expectedAmount} received=${txnAmount}`
            );
          } else if (shouldApplyStatusUpdate(payment.status, nextStatus) && payment.status !== nextStatus) {
            await prisma.payment.update({
              where: { id: paymentId },
              data: {
                status: nextStatus,
                referenceNo: getepayTxnId || undefined,
                bankTxnNo: getepayTxnId || undefined
              }
            });

            // console.log(`✅ [RETURN] Payment status updated to: ${nextStatus}`);

            if (nextStatus === "SUCCESS" && payment.admissionId) {
              await prisma.admission.update({
                where: { id: payment.admissionId },
                data: { status: "CONFIRMED" }
              });
              // console.log(`✅ [RETURN] Admission status confirmed`);
            }

          }

          if (nextStatus === "SUCCESS" && !payment.receiptUrl) {
            // console.log(`📄 [RETURN] Queueing receipt/certificate generation...`);
            triggerReceiptGenerationAsync(payment.id, "RETURN");
          }
        }
      } catch (updateError) {
        console.warn("⚠️  [RETURN] Failed to update payment:", updateError.message);
      }
    }

    // Redirect to frontend payment processing page
    if (!paymentId) {
      console.error('❌ [RETURN] No payment ID found');
      return res.redirect(buildProcessingRedirectUrl(null, { error: "payment_not_found" }));
    }

    let redirectStatus = txnStatus || "INITIATED";

    // If gateway return payload was missing/failed, derive status from DB to avoid INITIATED loops.
    if (paymentId && redirectStatus === "INITIATED") {
      const latestPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { status: true }
      });
      if (latestPayment?.status) {
        redirectStatus = latestPayment.status;
      }
    }

    const redirectUrl = buildProcessingRedirectUrl(paymentId, {
      status: redirectStatus
    });
    // console.log(`✅ [RETURN] Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error(`❌ [RETURN] Error:`, error.message);
    console.error('Stack:', error.stack);
    res.redirect(buildProcessingRedirectUrl(null, { error: "server_error" }));
  }
};

/**
 * STEP 3: Callback URL (SERVER → SERVER via POST)
 * GetEpay sends encrypted payment response here after payment completion
 * 
 * This handles the response as per GetEpay documentation Section 11-13
 * Response contains: txnStatus (SUCCESS/FAILED), merchantOrderNo (our txnId), amounts, etc.
 */
exports.paymentCallback = async (req, res, next) => {
  try {
    // console.log('\n' + '='.repeat(80));
    // console.log('🔔 [CALLBACK] ===== GETEPAY CALLBACK RECEIVED =====');
    // console.log('='.repeat(80));
    
    const encryptedResponse = getEncryptedGatewayResponse(req);

    // Check if response is present
    if (!encryptedResponse) {
      console.error('❌ [CALLBACK] Missing encrypted response in body');
      console.error('📦 [CALLBACK] Received body:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing encrypted response' 
      });
    }

    // console.log('📦 [CALLBACK] Received encrypted response (first 100 chars):', 
      // encryptedResponse.substring(0, 100) + '...');

    // Initialize decryption with GetEpay credentials
    const enc = new GcmPgEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY
    );

    // Decrypt response from GetEpay
    // console.log('🔐 [CALLBACK] Decrypting response with AES-256-GCM...');
    let decryptedData;
    try {
      decryptedData = await enc.decrypt(encryptedResponse);
      // console.log('✅ [CALLBACK] Decryption successful');
    } catch (decryptError) {
      console.error('❌ [CALLBACK] Decryption failed:', decryptError.message);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Decryption failed: ' + decryptError.message 
      });
    }

    // Parse decrypted JSON
    let decrypted;
    try {
      decrypted = JSON.parse(decryptedData);
      // console.log('✅ [CALLBACK] JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ [CALLBACK] JSON parse failed:', parseError.message);
      console.error('📦 [CALLBACK] Decrypted content:', decryptedData);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid JSON response' 
      });
    }

    // console.log('📋 [CALLBACK] Decrypted Response Data:');
    // console.log(JSON.stringify(decrypted, null, 2));

    if (!isGatewayIdentityValid(decrypted)) {
      console.error('❌ [CALLBACK] Gateway identity check failed');
      return res.status(403).json({
        status: 'error',
        message: 'Invalid gateway identity'
      });
    }

    // Extract key fields from GetEpay response
    // According to GetEpay doc Section 12, response contains:
    // - txnStatus: SUCCESS/FAILED
    // - merchantOrderNo: Our transaction ID
    // - getepayTxnId: GetEpay's transaction ID
    // - txnAmount: Amount paid
    // - paymentMode: DC/NEFT/UPI/etc
    // - txnDate: Transaction date

    const {
      merchantTxnId,
      txnStatus,
      getepayTxnId,
      paymentMode,
      txnDate,
      txnAmount,
      errorMessage
    } = parseGatewayResponseFields(decrypted);

    // console.log('🔍 [CALLBACK] Extracted Fields:');
    // console.log(`  ├─ Merchant Txn ID: ${merchantTxnId}`);
    // console.log(`  ├─ Status: ${txnStatus}`);
    // console.log(`  ├─ GetEpay Txn ID: ${getepayTxnId}`);
    // console.log(`  ├─ Amount: ${txnAmount}`);
    // console.log(`  ├─ Mode: ${paymentMode}`);
    // console.log(`  └─ Date: ${txnDate}`);

    // Validate transaction ID exists
    if (!merchantTxnId) {
      console.error('❌ [CALLBACK] Missing merchantOrderNo in response');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing merchantOrderNo in response' 
      });
    }

    // Find payment by our transaction ID
    // console.log(`\n🔍 [CALLBACK] Finding payment with txnId: ${merchantTxnId}`);
    const payment = await prisma.payment.findUnique({
      where: { txnId: merchantTxnId },
      include: {
        student: true,
        admission: true,
        breakups: true
      }
    });

    if (!payment) {
      console.error(`❌ [CALLBACK] Payment not found for txnId: ${merchantTxnId}`);
      return res.status(400).json({ 
        status: 'error', 
        message: `Payment not found for transaction: ${merchantTxnId}` 
      });
    }

    // console.log(`✅ [CALLBACK] Payment found: ${payment.id}`);
    // console.log(`  ├─ Student: ${payment.student?.name}`);
    // console.log(`  ├─ Amount: ₹${payment.totalAmount}`);
    // console.log(`  └─ Current Status: ${payment.status}`);

    const expectedAmount = parseCurrencyAmount(payment.totalAmount);
    const receivedAmount = parseCurrencyAmount(txnAmount);
    if (isAmountMismatch(expectedAmount, receivedAmount)) {
      console.error(
        `❌ [CALLBACK] Amount mismatch. expected=${expectedAmount} received=${receivedAmount}`
      );
      return res.status(400).json({
        status: "error",
        message: "Amount mismatch in gateway callback"
      });
    }

    const nextStatus = resolveInternalPaymentStatus(txnStatus);
    if (!shouldApplyStatusUpdate(payment.status, nextStatus)) {
      // console.log(
        // `ℹ️ [CALLBACK] Ignoring status downgrade ${payment.status} -> ${nextStatus}`
      // );
      return res.status(200).json({
        status: "success",
        message: "Callback received (ignored as non-progressive update)",
        paymentId: payment.id
      });
    }

    if (payment.status === nextStatus) {
      // console.log(`ℹ️ [CALLBACK] Idempotent callback (status already ${nextStatus})`);
      return res.status(200).json({
        status: "success",
        message: "Callback already processed",
        paymentId: payment.id
      });
    }

    // ========== HANDLE SUCCESS ==========
    if (txnStatus === GATEWAY_SUCCESS) {
      // console.log(`\n💰 [CALLBACK] ===== PAYMENT SUCCESSFUL =====`);
      // console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
      // console.log(`  Payment Mode: ${paymentMode}`);

      // Update payment with success details
      const updateData = {
        status: "SUCCESS",
        referenceNo: getepayTxnId || payment.referenceNo || null,
        bankTxnNo: getepayTxnId || payment.bankTxnNo || null
      };

      // console.log(`\n📝 [CALLBACK] Updating payment status to SUCCESS...`);
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: updateData
      });
      
      // console.log(`✅ [CALLBACK] Payment status updated to SUCCESS`);
      // console.log(`  ├─ ID: ${updatedPayment.id}`);
      // console.log(`  ├─ Status: ${updatedPayment.status}`);
      // console.log(`  └─ Reference: ${updatedPayment.referenceNo}`);

      // Update admission status if linked
      if (payment.admissionId) {
        // console.log(`\n📋 [CALLBACK] Updating admission status...`);
        await prisma.admission.update({
          where: { id: payment.admissionId },
          data: { status: 'CONFIRMED' }
        });
        // console.log(`✅ [CALLBACK] Admission confirmed`);
      }

      // Do not block callback ACK on PDF generation/upload.
      // console.log(`\n📄 [CALLBACK] Queueing receipt and certificate generation...`);
      triggerReceiptGenerationAsync(payment.id, "CALLBACK");

      // Log successful payment to audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: payment.studentId,
            action: 'PAYMENT_SUCCESS',
            entity: 'Payment',
            entityId: payment.id,
            payload: JSON.stringify({ 
              amount: payment.totalAmount,
              getepayTxnId: getepayTxnId,
              paymentMode: paymentMode,
              txnDate: txnDate
            })
          }
        });
        // console.log(`✅ [CALLBACK] Audit log created`);
      } catch (auditError) {
        console.warn(`⚠️  [CALLBACK] Audit log creation warning:`, auditError.message);
      }

      // console.log(`\n✅ [CALLBACK] ===== ALL OPERATIONS COMPLETED SUCCESSFULLY =====\n`);
      return res.status(200).json({ 
        status: 'success', 
        message: 'Payment processed successfully',
        paymentId: payment.id,
        getepayTxnId: getepayTxnId
      });

    } 
    // ========== HANDLE FAILURE ==========
    else if (txnStatus === GATEWAY_FAILED) {
      // console.log(`\n❌ [CALLBACK] ===== PAYMENT FAILED =====`);
      // console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
      // console.log(`  Failure Message: ${errorMessage || 'Unknown error'}`);

      // console.log(`\n📝 [CALLBACK] Updating payment status to FAILED...`);
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          referenceNo: getepayTxnId || payment.referenceNo || null,
          bankTxnNo: getepayTxnId || payment.bankTxnNo || null
        }
      });

      // console.log(`✅ [CALLBACK] Payment status updated to FAILED`);

      // Log failed payment to audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: payment.studentId,
            action: 'PAYMENT_FAILED',
            entity: 'Payment',
            entityId: payment.id,
            payload: JSON.stringify({ 
              amount: payment.totalAmount,
              getepayTxnId: getepayTxnId,
              error: errorMessage || 'Unknown error',
              txnDate: txnDate
            })
          }
        });
        // console.log(`✅ [CALLBACK] Audit log created for failure`);
      } catch (auditError) {
        console.warn(`⚠️  [CALLBACK] Audit log creation warning:`, auditError.message);
      }

      // console.log(`\n❌ [CALLBACK] ===== FAILURE PROCESSING COMPLETE =====\n`);
      return res.status(200).json({ 
        status: 'failed', 
        message: 'Payment failed',
        details: {
          paymentId: payment.id,
          txnStatus: txnStatus,
          error: errorMessage
        }
      });
    }
    // ========== UNKNOWN STATUS ==========
    else {
      // console.log(`\n⚠️  [CALLBACK] Unknown transaction status: ${txnStatus}`);
      // console.log(`\n⚠️  [CALLBACK] Updating payment status to PENDING...`);
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDING",
          referenceNo: getepayTxnId || null
        }
      });

      // console.log(`⚠️  [CALLBACK] ===== UNKNOWN STATUS RECORDED =====\n`);
      return res.status(200).json({ 
        status: 'pending', 
        message: 'Payment status unknown, marked for review',
        paymentId: payment.id,
        txnStatus: txnStatus
      });
    }

  } catch (error) {
    console.error('\n❌ [CALLBACK] CRITICAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    // console.log('='.repeat(80) + '\n');
    next(error);
  }
};


// const prisma = require('../config/prisma');
// const AppError = require('../utils/error');
// const { generatePaymentCSV, generateSummaryCSV } = require('../utils/dcr1ReportGenerator');
// const { 
//   createPayment, 
//   updatePaymentStatus, 
//   refundPayment 
// } = require('../validation/payment.validation');
// const axios = require("axios");
// const fs = require("fs");
// const moment = require("moment");
// const GetEpayEncryption = require("../utils/getepayEncryptProduction");
// const { generateReceiptAndCertificate } = require("./receipt.controller");
// const { generateReceiptPDF } = require("../utils/pdfGenerator");

// const GATEWAY_SUCCESS = "SUCCESS";
// const GATEWAY_FAILED = "FAILED";

// const normalizeTxnStatus = (status) => {
//   if (!status) return "";
//   return String(status).trim().toUpperCase();
// };

// const normalizeEncryptedResponse = (value) => {
//   if (!value) return null;
//   const raw = String(value).trim();
//   // Gateways sometimes post form-urlencoded where '+' becomes space.
//   return raw.includes(" ") ? raw.replace(/ /g, "+") : raw;
// };

// const getEncryptedGatewayResponse = (req) => {
//   return normalizeEncryptedResponse(
//     req.body?.response ||
//     req.body?.resp ||
//     req.query?.response ||
//     req.query?.resp ||
//     null
//   );
// };

// const parseGatewayResponseFields = (decrypted) => {
//   return {
//     merchantTxnId:
//       decrypted.merchantOrderNo ||
//       decrypted.merchantTransactionId ||
//       decrypted.merchantTxnId ||
//       null,
//     txnStatus: normalizeTxnStatus(
//       decrypted.txnStatus ||
//       decrypted.paymentStatus ||
//       decrypted.status
//     ),
//     getepayTxnId:
//       decrypted.getepayTxnId ||
//       decrypted.bankTxnNo ||
//       decrypted.referenceNo ||
//       null,
//     paymentMode: decrypted.paymentMode || null,
//     txnDate: decrypted.txnDate || null,
//     txnAmount: decrypted.txnAmount || decrypted.totalAmount || null,
//     errorMessage: decrypted.message || decrypted.errorMessage || null
//   };
// };

// const isUsableAbsoluteUrl = (value) => {
//   if (!value || value === "*" || value === "undefined" || value === "null") {
//     return false;
//   }

//   try {
//     const parsed = new URL(value);
//     return parsed.protocol === "http:" || parsed.protocol === "https:";
//   } catch {
//     return false;
//   }
// };

// const getPrimaryFrontendBase = () => {
//   const raw = String(process.env.FRONTEND_URL || "").trim();
//   const candidates = raw
//     .split(",")
//     .map((item) => item.trim())
//     .filter(Boolean);

//   const usable = candidates.find(isUsableAbsoluteUrl);
//   return usable || "http://localhost:5173";
// };

// const getBackendPublicBase = (req) => {
//   const configured = String(process.env.BACKEND_PUBLIC_URL || "").trim();
//   if (isUsableAbsoluteUrl(configured)) {
//     return configured.replace(/\/+$/, "");
//   }

//   if (req?.protocol && req?.get) {
//     return `${req.protocol}://${req.get("host")}`;
//   }

//   return "http://localhost:8080";
// };

// const buildGatewayReturnOrCallbackUrl = (req, type, paymentId) => {
//   const envKey = type === "callback" ? "GETEPAY_CALLBACK_URL" : "GETEPAY_RETURN_URL";
//   const configured = String(process.env[envKey] || "").trim();
//   const base =
//     isUsableAbsoluteUrl(configured)
//       ? configured
//       : `${getBackendPublicBase(req)}/api/v1/payments/${type === "callback" ? "callback" : "return"}`;

//   const url = new URL(base);
//   if (paymentId) {
//     url.searchParams.set("paymentId", paymentId);
//   }
//   return url.toString();
// };

// const buildProcessingRedirectUrl = (paymentId, extraQuery = {}) => {
//   const frontendBase = getPrimaryFrontendBase();
//   const hasProcessingPath = /\/payment-processing\/?$/.test(frontendBase);
//   const redirectBase = hasProcessingPath
//     ? frontendBase
//     : `${frontendBase.replace(/\/+$/, "")}/payment-processing`;

//   const redirectUrl = new URL(redirectBase);

//   if (paymentId) {
//     redirectUrl.searchParams.set("paymentId", paymentId);
//   }

//   Object.entries(extraQuery).forEach(([key, value]) => {
//     if (value !== undefined && value !== null && value !== "") {
//       redirectUrl.searchParams.set(key, String(value));
//     }
//   });

//   return redirectUrl.toString();
// };

// const parseCurrencyAmount = (value) => {
//   if (value === undefined || value === null) return null;
//   const cleaned = String(value).replace(/,/g, "").trim();
//   const amount = Number(cleaned);
//   return Number.isFinite(amount) ? amount : null;
// };

// const isAmountMismatch = (expected, received, tolerance = 0.01) => {
//   if (!Number.isFinite(expected) || !Number.isFinite(received)) return false;
//   return Math.abs(expected - received) > tolerance;
// };

// const statusPriority = {
//   PENDING: 0,
//   INITIATED: 1,
//   FAILED: 2,
//   SUCCESS: 3,
//   REFUNDED: 4
// };

// const shouldApplyStatusUpdate = (currentStatus, nextStatus) => {
//   const current = statusPriority[currentStatus] ?? -1;
//   const next = statusPriority[nextStatus] ?? -1;
//   return next >= current;
// };

// const resolveInternalPaymentStatus = (gatewayStatus) => {
//   if (gatewayStatus === GATEWAY_SUCCESS) return "SUCCESS";
//   if (gatewayStatus === GATEWAY_FAILED) return "FAILED";
//   return "PENDING";
// };

// const isGatewayIdentityValid = (decrypted) => {
//   const configuredMid = String(process.env.GETEPAY_MID || "").trim();
//   const configuredTerminal = String(process.env.GETEPAY_TERMINAL_ID || "").trim();

//   const responseMid = decrypted?.mid || decrypted?.merchantId || decrypted?.merchantCode || "";
//   const responseTerminal = decrypted?.terminalId || decrypted?.terminal || "";

//   const midMatches = !responseMid || !configuredMid || String(responseMid).trim() === configuredMid;
//   const terminalMatches =
//     !responseTerminal || !configuredTerminal || String(responseTerminal).trim() === configuredTerminal;

//   return midMatches && terminalMatches;
// };

// const triggerReceiptGenerationAsync = (paymentId, source) => {
//   setImmediate(async () => {
//     try {
      // console.log(`📄 [${source}] Async receipt/certificate generation started for ${paymentId}`);
//       await generateReceiptAndCertificate(paymentId);
      // console.log(`✅ [${source}] Async receipt/certificate generation completed for ${paymentId}`);
//     } catch (err) {
//       console.warn(`⚠️  [${source}] Async receipt/certificate generation failed:`, err.message);
//     }
//   });
// };

// /**
//  * Create a new payment
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.createPayment = async (req, res, next) => {
//   try {
//     // Validate request body
//     const { error, value } = createPayment.validate(req.body);
//     if (error) {
//       return next(new AppError(error.details.map(d => d.message).join(', '), 400));
//     }

//     const { studentId, admissionId, totalAmount, gateway, txnId, referenceNo, breakups } = value;

//     // For testing: return mock payment if database unavailable
//     try {
//       // Check if student exists
//       const student = await prisma.student.findUnique({
//         where: { id: studentId }
//       });

//       if (!student) {
//         return next(new AppError('Student not found', 404));
//       }
//     } catch (dbError) {
//       console.warn('⚠️  Database unavailable, using mock data for testing');
      
//       // Return mock payment for testing
//       const mockPayment = {
//         id: `mock-${Date.now()}`,
//         studentId,
//         totalAmount,
//         status: 'INITIATED',
//         gateway: 'GETEPAY',
//         txnId,
//         receiptNo: `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
//         student: {
//           id: studentId,
//           name: 'Test Student',
//           email: 'test@example.com',
//           reg_no: 'TEST-001'
//         },
//         breakups: breakups || [{ head: 'TUITION', amount: totalAmount }]
//       };
      
//       return res.status(201).json({
//         status: 'success',
//         message: 'Payment initiated successfully (MOCK MODE)',
//         data: { payment: mockPayment }
//       });
//     }

//     // Check if admission exists (if provided)
//     let admission = null;
//     if (admissionId) {
//       admission = await prisma.admission.findUnique({
//         where: { id: admissionId }
//       });

//       if (!admission) {
//         return next(new AppError('Admission not found', 404));
//       }

//       // Verify that admission belongs to the student
//       if (admission.studentId !== studentId) {
//         return next(new AppError('Admission does not belong to the specified student', 400));
//       }
//     }

//     // Check if transaction ID already exists
//     const existingPayment = await prisma.payment.findUnique({
//       where: { txnId }
//     });

//     if (existingPayment) {
//       return next(new AppError('Payment with this transaction ID already exists', 400));
//     }

//     // Generate receipt number
//     const receiptNo = `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

//     // Create payment in a transaction
//     const payment = await prisma.$transaction(async (tx) => {
//       // Create payment
//       const newPayment = await tx.payment.create({
//         data: {
//           studentId,
//           admissionId: admissionId || null,
//           totalAmount,
//           status: 'INITIATED',
//           gateway,
//           txnId,
//           referenceNo: referenceNo || null,
//           receiptNo
//         }
//       });

//       // Create payment breakups if provided
//       if (breakups && breakups.length > 0) {
//         const breakupData = breakups.map(breakup => ({
//           paymentId: newPayment.id,
//           head: breakup.head,
//           amount: breakup.amount
//         }));

//         await tx.paymentBreakup.createMany({
//           data: breakupData
//         });
//       }

//       return newPayment;
//     });

//     // Fetch complete payment with breakups
//     const completePayment = await prisma.payment.findUnique({
//       where: { id: payment.id },
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             reg_no: true,
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             status: true
//           }
//         },
//         breakups: true
//       }
//     });

//     // Log audit entry (only if user is authenticated)
//     if (req.user && req.user.id) {
//       await prisma.auditLog.create({
//         data: {
//           userId: req.user.id,
//           action: 'CREATE_PAYMENT',
//           entity: 'Payment',
//           entityId: payment.id,
//           payload: JSON.stringify({ studentId, admissionId, totalAmount, gateway, txnId })
//         }
//       });
//     }

//     res.status(201).json({
//       status: 'success',
//       message: 'Payment initiated successfully',
//       data: {
//         payment: completePayment
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Get all payments with filtering options
//  * Access: ADMIN, ACCOUNTANT, HOD
//  */
// exports.getAllPayments = async (req, res, next) => {
//   try {
//     const { status, studentId, admissionId } = req.query;
    
//     // Build where clause
//     const where = {};
    
//     if (status) {
//       where.status = status;
//     }
    
//     if (studentId) {
//       where.studentId = studentId;
//     }
    
//     if (admissionId) {
//       where.admissionId = admissionId;
//     }

//     // Get payments
//     const payments = await prisma.payment.findMany({
//       where,
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             reg_no: true,
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             status: true
//           }
//         },
//         breakups: true
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });

//     res.status(200).json({
//       status: 'success',
//       results: payments.length,
//       data: {
//         payments
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Get payment by ID
//  * Access: ADMIN, ACCOUNTANT, HOD
//  */
// exports.getPayment = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     const payment = await prisma.payment.findUnique({
//       where: { id },
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             reg_no: true,
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             status: true
//           }
//         },
//         breakups: true
//       }
//     });

//     if (!payment) {
//       return next(new AppError('Payment not found', 404));
//     }

//     if (payment.status === "SUCCESS") {
//       payment.invoiceUrl = payment.receiptUrl || `${getBackendPublicBase(req)}/api/v1/payments/public/${payment.id}/invoice`;
//     }

//     res.status(200).json({
//       status: 'success',
//       data: {
//         payment
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Download/preview invoice PDF (public)
//  * Access: Public by payment id (UUID); only for SUCCESS payments
//  */
// exports.downloadPublicInvoice = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     const payment = await prisma.payment.findUnique({
//       where: { id },
//       include: {
//         student: true,
//         breakups: true
//       }
//     });

//     if (!payment) {
//       return next(new AppError("Payment not found", 404));
//     }

//     if (payment.status !== "SUCCESS") {
//       return next(new AppError("Invoice available only for successful payments", 400));
//     }

//     // Fast path: if receipt was already uploaded, redirect to persisted file.
//     if (payment.receiptUrl) {
//       return res.redirect(payment.receiptUrl);
//     }

//     const receiptPath = await generateReceiptPDF(payment);

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `inline; filename="Invoice-${payment.receiptNo}.pdf"`);

//     const stream = fs.createReadStream(receiptPath);
//     stream.on("error", (err) => next(err));
//     stream.on("close", () => {
//       fs.promises.unlink(receiptPath).catch(() => {});
//     });
//     stream.pipe(res);
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Update payment status
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.updatePaymentStatus = async (req, res, next) => {
//   try {
//     const { id } = req.params;
    
//     // Validate request body
//     const { error, value } = updatePaymentStatus.validate(req.body);
//     if (error) {
//       return next(new AppError(error.details.map(d => d.message).join(', '), 400));
//     }

//     const { status, notes } = value;

//     // Get current payment
//     const payment = await prisma.payment.findUnique({
//       where: { id }
//     });

//     if (!payment) {
//       return next(new AppError('Payment not found', 404));
//     }

//     // Validate status transition
//     const validTransitions = {
//       'INITIATED': ['SUCCESS', 'FAILED'],
//       'SUCCESS': ['REFUNDED'],
//       'FAILED': [],
//       'REFUNDED': []
//     };

//     // Check if current status allows transition to new status
//     const allowedTransitions = validTransitions[payment.status] || [];
    
//     if (!allowedTransitions.includes(status)) {
//       return next(new AppError(
//         `Invalid status transition from ${payment.status} to ${status}`, 
//         400
//       ));
//     }

//     // Update payment status
//     const updatedPayment = await prisma.payment.update({
//       where: { id },
//       data: { 
//         status
//       },
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             reg_no: true,
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             status: true
//           }
//         },
//         breakups: true
//       }
//     });

//     // If payment is successful and linked to an admission, update admission status
//     if (status === 'SUCCESS' && payment.admissionId) {
//       await prisma.admission.update({
//         where: { id: payment.admissionId },
//         data: { status: 'CONFIRMED' }
//       });
//     }

//     // Log audit entry
//     await prisma.auditLog.create({
//       data: {
//         userId: req.user.id,
//         action: 'UPDATE_PAYMENT_STATUS',
//         entity: 'Payment',
//         entityId: id,
//         payload: JSON.stringify({ fromStatus: payment.status, toStatus: status, notes })
//       }
//     });

//     res.status(200).json({
//       status: 'success',
//       message: 'Payment status updated successfully',
//       data: {
//         payment: updatedPayment
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Refund a payment
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.refundPayment = async (req, res, next) => {
//   try {
//     const { id } = req.params;
    
//     // Validate request body
//     const { error, value } = refundPayment.validate(req.body);
//     if (error) {
//       return next(new AppError(error.details.map(d => d.message).join(', '), 400));
//     }

//     const { reason, refundAmount } = value;

//     // Get current payment
//     const payment = await prisma.payment.findUnique({
//       where: { id }
//     });

//     if (!payment) {
//       return next(new AppError('Payment not found', 404));
//     }

//     // Check if payment can be refunded
//     if (payment.status !== 'SUCCESS') {
//       return next(new AppError('Only successful payments can be refunded', 400));
//     }

//     // Check if payment is already refunded
//     if (payment.status === 'REFUNDED') {
//       return next(new AppError('Payment is already refunded', 400));
//     }

//     // Update payment status to REFUNDED
//     const updatedPayment = await prisma.payment.update({
//       where: { id },
//       data: { 
//         status: 'REFUNDED'
//       },
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             reg_no: true,
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             status: true
//           }
//         },
//         breakups: true
//       }
//     });

//     // Create refund record (in a real implementation, this would integrate with payment gateway)
//     const refund = await prisma.$transaction(async (tx) => {
//       // Create refund record
//       const refundRecord = await tx.refund.create({
//         data: {
//           paymentId: id,
//           amount: refundAmount || payment.totalAmount,
//           reason,
//           refundedById: req.user.id,
//           refundedAt: new Date()
//         }
//       });

//       return refundRecord;
//     });

//     // Log audit entry
//     await prisma.auditLog.create({
//       data: {
//         userId: req.user.id,
//         action: 'REFUND_PAYMENT',
//         entity: 'Payment',
//         entityId: id,
//         payload: JSON.stringify({ refundAmount: refundAmount || payment.totalAmount, reason })
//       }
//     });

//     res.status(200).json({
//       status: 'success',
//       message: 'Payment refunded successfully',
//       data: {
//         payment: updatedPayment,
//         refund
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Get DCR1 - Daily Collection Report
//  * Returns:
//  * - Total admission payment collection (all-time)
//  * - This month's admission payment collection
//  * - Today's admission payment collection
//  * 
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.getDCR1Report = async (req, res, next) => {
//   try {
//     const now = new Date();
    
//     // Start of today (midnight)
//     const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
//     // Start of this month (1st day at midnight)
//     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
//     // End of today (just before midnight)
//     const endOfToday = new Date(startOfToday);
//     endOfToday.setDate(endOfToday.getDate() + 1);
    
//     // Get total admission payment collection (all-time SUCCESS payments linked to admissions)
//     const totalCollection = await prisma.payment.aggregate({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null } // Only admission-linked payments
//       },
//       _sum: {
//         totalAmount: true
//       },
//       _count: true
//     });
    
//     // Get this month's admission payment collection
//     const monthCollection = await prisma.payment.aggregate({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: startOfMonth,
//           lt: endOfToday // Up to now
//         }
//       },
//       _sum: {
//         totalAmount: true
//       },
//       _count: true
//     });
    
//     // Get today's admission payment collection
//     const todayCollection = await prisma.payment.aggregate({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: startOfToday,
//           lt: endOfToday
//         }
//       },
//       _sum: {
//         totalAmount: true
//       },
//       _count: true
//     });
    
//     // Get detailed breakdown for today's collections
//     const todayPaymentsDetail = await prisma.payment.findMany({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: startOfToday,
//           lt: endOfToday
//         }
//       },
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             reg_no: true,
//             email: true
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             admissionNo: true,
//             course: {
//               select: {
//                 id: true,
//                 name: true,
//                 code: true
//               }
//             }
//           }
//         },
//         breakups: true
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });
    
//     // Get detailed breakdown for this month's collections
//     const monthPaymentsDetail = await prisma.payment.findMany({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: startOfMonth,
//           lt: endOfToday
//         }
//       },
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             reg_no: true,
//             email: true
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             admissionNo: true,
//             course: {
//               select: {
//                 id: true,
//                 name: true,
//                 code: true
//               }
//             }
//           }
//         },
//         breakups: true
//       },
//       orderBy: {
//         createdAt: 'desc'
//       },
//       take: 100 // Limit to recent 100 transactions for performance
//     });
    
//     // Format the report
//     const dcr1Report = {
//       reportDate: now.toISOString(),
//       reportType: 'DCR1 - Daily Collection Report',
//       summary: {
//         totalCollection: {
//           amount: totalCollection._sum.totalAmount || 0,
//           count: totalCollection._count || 0,
//           period: 'All Time'
//         },
//         monthCollection: {
//           amount: monthCollection._sum.totalAmount || 0,
//           count: monthCollection._count || 0,
//           period: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
//           startDate: startOfMonth.toISOString(),
//           endDate: now.toISOString()
//         },
//         todayCollection: {
//           amount: todayCollection._sum.totalAmount || 0,
//           count: todayCollection._count || 0,
//           period: 'Today',
//           date: startOfToday.toISOString()
//         }
//       },
//       details: {
//         todayPayments: todayPaymentsDetail,
//         monthPayments: monthPaymentsDetail
//       }
//     };
    
//     res.status(200).json({
//       status: 'success',
//       message: 'DCR1 report generated successfully',
//       data: {
//         report: dcr1Report
//       }
//     });
    
//   } catch (error) {
//     console.error('Error generating DCR1 report:', error.message);
//     next(error);
//   }
// };

// /**
//  * Get DCR1 Report with Date Range Filter
//  * Returns:
//  * - Total collection within date range
//  * - Transaction details within date range
//  * - CSV export option
//  * - Summary statistics
//  * 
//  * Query Params:
//  * - startDate: Start date (ISO format: YYYY-MM-DD)
//  * - endDate: End date (ISO format: YYYY-MM-DD)
//  * - format: 'json' or 'csv' (default: 'json')
//  * 
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.getDCR1ReportWithDateRange = async (req, res, next) => {
//   try {
//     const { startDate, endDate, format } = req.query;
    
//     // Parse dates
//     const start = new Date(startDate);
//     const end = new Date(endDate);
    
//     // Set start to beginning of day
//     start.setHours(0, 0, 0, 0);
    
//     // Set end to end of day
//     end.setHours(23, 59, 59, 999);
    
//     // Validate date range
//     if (isNaN(start.getTime()) || isNaN(end.getTime())) {
//       return next(new AppError('Invalid date format. Use ISO format (YYYY-MM-DD)', 400));
//     }
    
//     if (start > end) {
//       return next(new AppError('Start date cannot be after end date', 400));
//     }
    
//     // Limit range to max 1 year for performance
//     const diffTime = Math.abs(end - start);
//     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
//     if (diffDays > 365) {
//       return next(new AppError('Date range cannot exceed 365 days', 400));
//     }
    
//     // Get total collection within date range
//     const rangeCollection = await prisma.payment.aggregate({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: start,
//           lte: end
//         }
//       },
//       _sum: {
//         totalAmount: true
//       },
//       _count: true
//     });
    
//     // Get all detailed transactions within date range
//     const paymentsDetail = await prisma.payment.findMany({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: start,
//           lte: end
//         }
//       },
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             reg_no: true,
//             email: true
//           }
//         },
//         admission: {
//           select: {
//             id: true,
//             admissionNo: true,
//             course: {
//               select: {
//                 id: true,
//                 name: true,
//                 code: true
//               }
//             }
//           }
//         },
//         breakups: true
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });
    
//     // Calculate summary
//     const totalAmount = rangeCollection._sum.totalAmount || 0;
//     const totalCount = rangeCollection._count || 0;
//     const averageAmount = totalCount > 0 ? (totalAmount / totalCount) : 0;
    
//     // Prepare summary object
//     const summary = {
//       totalCollection: {
//         amount: Number(totalAmount),
//         count: totalCount,
//         period: `${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`,
//         startDate: start.toISOString(),
//         endDate: end.toISOString()
//       },
//       averageTransaction: {
//         amount: Number(averageAmount.toFixed(2)),
//         description: 'Average per transaction'
//       }
//     };
    
//     // If CSV format requested
//     if (format === 'csv') {
//       const { csvData, fileName } = generatePaymentCSV(paymentsDetail);
      
//       // Add summary at the end of CSV
//       const summaryCSV = generateSummaryCSV(summary, start, end);
//       const finalCSV = csvData + '\n\n' + summaryCSV;
      
//       res.setHeader('Content-Type', 'text/csv');
//       res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
//       return res.send(finalCSV);
//     }
    
//     // Format the JSON report
//     const dcr1Report = {
//       reportType: 'DCR1 - Date Range Collection Report',
//       generatedAt: new Date().toISOString(),
//       dateRange: {
//         startDate: start.toISOString(),
//         endDate: end.toISOString(),
//         formattedRange: `${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`,
//         totalDays: diffDays
//       },
//       summary: summary,
//       statistics: {
//         totalTransactions: totalCount,
//         successfulAmount: Number(totalAmount),
//         averageTransactionValue: Number(averageAmount.toFixed(2)),
//         highestTransaction: paymentsDetail.length > 0 
//           ? Math.max(...paymentsDetail.map(p => Number(p.totalAmount))) 
//           : 0,
//         lowestTransaction: paymentsDetail.length > 0 
//           ? Math.min(...paymentsDetail.map(p => Number(p.totalAmount))) 
//           : 0
//       },
//       transactions: paymentsDetail,
//       downloadLinks: {
//         csv: `/api/v1/payments/dcr1-report/date-range?startDate=${startDate}&endDate=${endDate}&format=csv`
//       }
//     };
    
//     res.status(200).json({
//       status: 'success',
//       message: `DCR1 report generated for ${diffDays + 1} days`,
//       data: {
//         report: dcr1Report
//       }
//     });
    
//   } catch (error) {
//     console.error('Error generating DCR1 date range report:', error.message);
//     next(error);
//   }
// };

// /**
//  * Get Today's Collection Summary
//  * Quick endpoint for today's collection only
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.getTodayCollection = async (req, res, next) => {
//   try {
//     const now = new Date();
//     const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//     const endOfToday = new Date(startOfToday);
//     endOfToday.setDate(endOfToday.getDate() + 1);
    
//     const todayCollection = await prisma.payment.aggregate({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: startOfToday,
//           lt: endOfToday
//         }
//       },
//       _sum: {
//         totalAmount: true
//       },
//       _count: true
//     });
    
//     res.status(200).json({
//       status: 'success',
//       data: {
//         today: {
//           amount: Number(todayCollection._sum.totalAmount || 0),
//           count: todayCollection._count || 0,
//           date: startOfToday.toISOString()
//         }
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Get Month's Collection Summary
//  * Quick endpoint for current month's collection only
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.getMonthCollection = async (req, res, next) => {
//   try {
//     const now = new Date();
//     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//     const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
//     const monthCollection = await prisma.payment.aggregate({
//       where: {
//         status: 'SUCCESS',
//         admissionId: { not: null },
//         createdAt: {
//           gte: startOfMonth,
//           lte: endOfMonth
//         }
//       },
//       _sum: {
//         totalAmount: true
//       },
//       _count: true
//     });
    
//     res.status(200).json({
//       status: 'success',
//       data: {
//         month: {
//           amount: Number(monthCollection._sum.totalAmount || 0),
//           count: monthCollection._count || 0,
//           startDate: startOfMonth.toISOString(),
//           endDate: endOfMonth.toISOString(),
//           monthName: now.toLocaleString('default', { month: 'long' }),
//           year: now.getFullYear()
//         }
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Requery payment status from GetEpay gateway
//  * Used to manually verify pending/failed payments
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.requeryPaymentStatus = async (req, res, next) => {
//   try {
//     const { id } = req.params;
    // console.log(`🔍 Requering payment status for: ${id}`);

//     const payment = await prisma.payment.findUnique({
//       where: { id },
//       include: { student: true }
//     });

//     if (!payment) {
//       return next(new AppError("Payment not found", 404));
//     }

//     // Validate environment variables
//     if (!process.env.GETEPAY_MID || !process.env.GETEPAY_TERMINAL_ID || 
//         !process.env.GETEPAY_KEY || !process.env.GETEPAY_IV) {
//       throw new AppError("GetEpay gateway configuration missing", 500);
//     }

//     // Build requery payload
//     const requeryPayload = {
//       mid: process.env.GETEPAY_MID,
//       paymentId: payment.gatewayPaymentId || "", // Use gatewayPaymentId if available
//       referenceNo: payment.referenceNo || "",
//       status: "",
//       terminalId: process.env.GETEPAY_TERMINAL_ID
//     };

    // console.log(`📦 Requery payload:`, requeryPayload);

//     // Initialize encryption based on environment
//     const enc = new GetEpayEncryption(
//       process.env.GETEPAY_IV,
//       process.env.GETEPAY_KEY,
//       process.env.NODE_ENV === 'production'
//     );

//     // Encrypt the request
//     const encrypted = await enc.encrypt(JSON.stringify(requeryPayload));

//     // Determine requery endpoint
//     const requeryUrl = process.env.NODE_ENV === 'production'
//       ? 'https://portal.getepay.in/getepayPortal/pg/invoiceStatus'
//       : 'https://pay1.getepay.in:8443/getepayPortal/pg/invoiceStatus';

    // console.log(`🚀 Calling GetEpay Requery API at: ${requeryUrl}`);

//     let response;
//     try {
//       response = await axios.post(requeryUrl, {
//         mid: process.env.GETEPAY_MID,
//         req: encrypted,
//         terminalId: process.env.GETEPAY_TERMINAL_ID
//       }, {
//         timeout: 30000,
//         headers: {
//           'Content-Type': 'application/json',
//           'Accept': 'application/json'
//         }
//       });
//     } catch (axiosError) {
//       console.error('❌ GetEpay Requery API Error:', {
//         status: axiosError.response?.status,
//         statusText: axiosError.response?.statusText,
//         data: axiosError.response?.data,
//         message: axiosError.message
//       });
//       throw new AppError(`Requery failed: ${axiosError.message}`, 502);
//     }

//     // Check response
//     if (!response.data || !response.data.response) {
//       throw new AppError('Invalid response from payment gateway', 502);
//     }

//     // Decrypt response
//     let decrypted;
//     try {
//       const decryptedStr = await enc.decrypt(response.data.response);
//       decrypted = JSON.parse(decryptedStr);
//     } catch (decryptError) {
//       throw new AppError(`Failed to decrypt requery response: ${decryptError.message}`, 502);
//     }

    // console.log(`✅ Decrypted requery response:`, decrypted);

//     // Update payment status if needed
//     const gatewayStatus = normalizeTxnStatus(decrypted.txnStatus || decrypted.paymentStatus);
//     let updateData = {};

//     if (gatewayStatus === 'SUCCESS' && payment.status !== 'SUCCESS') {
//       updateData = {
//         status: 'SUCCESS',
//         bankTxnNo: decrypted.getepayTxnId || payment.bankTxnNo,
//         referenceNo: decrypted.merchantOrderNo || payment.referenceNo
//       };
      
//       await prisma.payment.update({
//         where: { id },
//         data: updateData
//       });

      // console.log(`✅ Payment status updated to SUCCESS`);
//     } else if (gatewayStatus === 'FAILED' || gatewayStatus === 'PENDING') {
      // console.log(`⚠️ Payment status: ${gatewayStatus}`);
//     }

//     res.status(200).json({
//       status: "success",
//       message: "Payment status requeried successfully",
//       data: {
//         paymentId: payment.id,
//         receiptNo: payment.receiptNo,
//         currentStatus: payment.status,
//         gatewayStatus: gatewayStatus,
//         gatewayTxnId: decrypted.getepayTxnId || "N/A",
//         amount: payment.totalAmount,
//         lastUpdated: new Date().toISOString()
//       }
//     });
//   } catch (error) {
//     console.error('❌ Error in requeryPaymentStatus:', error.message);
//     next(error);
//   }
// };

// /**
//  * Get payment statistics
//  * Access: ADMIN, ACCOUNTANT, HOD
//  */
// exports.getPaymentStats = async (req, res, next) => {
//   try {
//     // Get payment statistics
//     const stats = await prisma.payment.groupBy({
//       by: ['status'],
//       _sum: {
//         totalAmount: true
//       },
//       _count: true
//     });

//     // Get recent payments
//     const recentPayments = await prisma.payment.findMany({
//       take: 10,
//       include: {
//         student: {
//           select: {
//             id: true,
//             name: true,
//             reg_no: true,
//           }
//         }
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });

//     res.status(200).json({
//       status: 'success',
//       data: {
//         stats,
//         recentPayments
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * STEP 1: Generate Payment Link via GetEpay Gateway
//  * Access: ADMIN, ACCOUNTANT
//  */
// exports.generatePaymentLink = async (req, res, next) => {
//   try {
//     const { paymentId } = req.params;
    // console.log(`🔗 Generating payment link for payment: ${paymentId}`);

//     const payment = await prisma.payment.findUnique({
//       where: { id: paymentId },
//       include: { student: true }
//     });

//     if (!payment) {
//       console.error(`❌ Payment not found: ${paymentId}`);
//       return next(new AppError("Payment not found", 404));
//     }

    // console.log(`✅ Payment found: ${payment.receiptNo}, Amount: ${payment.totalAmount}`);

//     // Build GetEpay payload
//     const returnUrl = buildGatewayReturnOrCallbackUrl(req, "return", payment.id);
//     const callbackUrl = buildGatewayReturnOrCallbackUrl(req, "callback", payment.id);

//     const payload = {
//       mid: process.env.GETEPAY_MID,
//       terminalId: process.env.GETEPAY_TERMINAL_ID,
//       amount: payment.totalAmount.toString(),
//       merchantTransactionId: payment.txnId,
//       transactionDate: moment().format("DD-MM-YYYY HH:mm:ss"),
//       ru: returnUrl,
//       callbackUrl: callbackUrl,
//       currency: "INR",
//       paymentMode: "ALL",
//       txnType: "single",
//       productType: "PAYMENT",
//       txnNote: `Payment for ${payment.student.name} - ${payment.receiptNo}`,
//       udf1: payment.student.phone || "",
//       udf2: payment.student.email || "",
//       udf3: payment.student.name || "",
//       udf4: "",
//       udf5: "",
//       udf6: "",
//       udf7: "",
//       udf8: "",
//       udf9: "",
//       udf10: "",
//       vpa: process.env.GETEPAY_TERMINAL_ID
//     };

    // console.log(`📦 Payload created, amount: ${payload.amount}`);

//     // Initialize encryption
    // console.log(`🔑 IV: ${process.env.GETEPAY_IV ? 'Set' : 'NULL'}`);
    // console.log(`🔑 KEY: ${process.env.GETEPAY_KEY ? 'Set' : 'NULL'}`);
    // console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

//     const enc = new GetEpayEncryption(
//       process.env.GETEPAY_IV,
//       process.env.GETEPAY_KEY,
//       process.env.NODE_ENV === 'production'
//     );

    // console.log(`🔐 Encrypting payload...`);
//     const encrypted = await enc.encrypt(JSON.stringify(payload));
//     console.log(`✅ Encrypted successfully, length: ${encrypted.length}`);

//     // Call GetEpay API
//     console.log(`🚀 Calling GetEpay API at: ${process.env.GETEPAY_URL}`);
//     console.log(`📤 Request data:`, {
//       mid: process.env.GETEPAY_MID,
//       terminalId: process.env.GETEPAY_TERMINAL_ID,
//       req: encrypted.substring(0, 50) + '...' // Show first 50 chars
//     });
    
//     // 🔴 TEMPORARY DEBUG: Log FULL encrypted request for developer verification
//     console.log(`🔴 [DEBUG] FULL ENCRYPTED REQUEST:`);
//     console.log(encrypted);
//     console.log(`🔴 [DEBUG] Encrypted length: ${encrypted.length} characters`);
    
//     // Also log the exact JSON that will be sent
//     const requestData = {
//       mid: process.env.GETEPAY_MID,
//       terminalId: process.env.GETEPAY_TERMINAL_ID,
//       req: encrypted
//     };
//     console.log(`🔴 [DEBUG] Complete JSON to send:`, JSON.stringify(requestData, null, 2));

//     let response;
//     try {
//       response = await axios.post(process.env.GETEPAY_URL, {
//         mid: process.env.GETEPAY_MID,
//         terminalId: process.env.GETEPAY_TERMINAL_ID,
//         req: encrypted
//       }, {
//         timeout: 60000, // 60 second timeout for production
//         headers: {
//           'Content-Type': 'application/json',
//           'Accept': 'application/json'
//         },
//         validateStatus: function (status) {
//           return status >= 200 && status < 300; // Accept only 2xx status
//         },
//         responseType: 'json',
//         maxRedirects: 5,
//         transformResponse: [(data) => {
//           try {
//             if (typeof data === 'string') {
//               // Check if it's HTML error page
//               if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
//                 console.error('❌ Received HTML response from GetEpay - gateway authentication/authorization failed');
//                 throw new Error('Gateway returned HTML error page - check credentials and endpoint');
//               }
//               return JSON.parse(data);
//             }
//             return data;
//           } catch (e) {
//             console.error('❌ Response transformation error:', e.message);
//             throw e;
//           }
//         }]
//       });
//     } catch (axiosError) {
//       console.error('❌ GetEpay API Error in generatePaymentLink:', {
//         status: axiosError.response?.status,
//         statusText: axiosError.response?.statusText,
//         data: typeof axiosError.response?.data === 'string' 
//           ? axiosError.response.data.substring(0, 500) + '...' 
//           : axiosError.response?.data,
//         message: axiosError.message,
//         code: axiosError.code,
//         url: process.env.GETEPAY_URL
//       });
      
//       // Handle HTML error responses (authentication/authorization failures)
//       if (typeof axiosError.response?.data === 'string' && 
//           (axiosError.response.data.includes('<!DOCTYPE') || axiosError.response.data.includes('<html'))) {
//         console.error('❌ Gateway returned HTML error page. Common causes:');
//         console.error('   1. Invalid MID or Terminal ID credentials');
//         console.error('   2. Incorrect API endpoint URL (check port and path)');
//         console.error('   3. Network/firewall blocking the request');
//         console.error('   4. Gateway server is down or returning errors');
//         console.error('   5. Merchant account not activated for this endpoint');
//         throw new AppError(
//           `Payment gateway authentication failed. Please verify configuration:\n` +
//           `   • MID: ${process.env.GETEPAY_MID}\n` +
//           `   • Terminal ID: ${process.env.GETEPAY_TERMINAL_ID}\n` +
//           `   • Endpoint: ${process.env.GETEPAY_URL}\n` +
//           `   Contact support if credentials are correct.`,
//           502
//         );
//       }
      
//       if (axiosError.code === 'ECONNABORTED') {
//         throw new AppError('Payment gateway request timeout. Please try again.', 504);
//       } else if (axiosError.response?.status === 502 || axiosError.response?.status === 503) {
//         throw new AppError('Payment gateway temporarily unavailable. Please try again later.', 502);
//       } else if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
//         throw new AppError('Payment gateway authentication failed. Please contact support.', 502);
//       } else {
//         throw new AppError(`GetEpay API error: ${axiosError.message}`, 502);
//       }
//     }

//     console.log(`✅ GetEpay API response status: ${response.status}`);
//     console.log(`📥 Full Response object keys:`, Object.keys(response.data));
//     console.log(`📥 Complete Response data:`, JSON.stringify(response.data, null, 2));

//     // Check if GetEpay returned an error
//     if (response.data.status === 'FAILED') {
//       console.error('❌ GetEpay Error:', response.data.message);
//       throw new AppError(`GetEpay Error: ${response.data.message}`, 502);
//     }

//     // Check if response has the expected structure
//     if (!response.data) {
//       console.error('❌ GetEpay response is empty');
//       throw new AppError('GetEpay returned empty response', 502);
//     }

//     console.log(`🔍 Checking for response field...`);
//     console.log(`   response.data.response exists?`, !!response.data.response);
//     console.log(`   response.data.resp exists?`, !!response.data.resp);
//     console.log(`   response.data.paymentUrl exists?`, !!response.data.paymentUrl);
//     console.log(`   All data keys:`, Object.keys(response.data));

//     if (!response.data.response) {
//       console.error('❌ GetEpay response.data.response is missing');
//       console.error('Available fields:', Object.keys(response.data));
//       throw new AppError('GetEpay response format invalid - no encrypted response data', 502);
//     }

//     // Decrypt response
//     console.log(`🔓 Decrypting response...`);
//     let decrypted;
//     try {
//       const decryptedStr = await enc.decrypt(response.data.response);
//       if (!decryptedStr) {
//         throw new Error('Decryption returned empty string');
//       }
//       decrypted = JSON.parse(decryptedStr);
//     } catch (decryptError) {
//       console.error('❌ Decryption error:', decryptError.message);
//       throw new AppError(`Decryption failed: ${decryptError.message}`, 502);
//     }
//     console.log(`✅ Decrypted response:`, decrypted);

//     // Update payment with gateway reference
//     await prisma.payment.update({
//       where: { id: paymentId },
//       data: {
//         gateway: "GETEPAY",
//         status: "INITIATED",
//         gatewayPaymentId: decrypted.paymentId?.toString() || null
//       }
//     });

//     // Log audit entry (only if user is authenticated)
//     if (req.user && req.user.id) {
//       await prisma.auditLog.create({
//         data: {
//           userId: req.user.id,
//           action: 'GENERATE_PAYMENT_LINK',
//           entity: 'Payment',
//           entityId: paymentId,
//           payload: JSON.stringify({ amount: payment.totalAmount, gateway: 'GETEPAY' })
//         }
//       });
//     }

//     console.log(`✅ Payment link generated successfully`);

//     res.status(200).json({
//       status: "success",
//       message: "Payment link generated successfully",
//       data: {
//         paymentUrl: decrypted.paymentUrl,
//         paymentId: payment.id
//       }
//     });
//   } catch (error) {
//     console.error('❌ Error in generatePaymentLink:', error.message);
//     console.error('❌ Stack trace:', error.stack);
//     next(error);
//   }
// };

// /**
//  * STEP 1B: Generate Payment Link for Students (Student Initiated)
//  * Access: STUDENT (via token)
//  */
// exports.studentGeneratePaymentLink = async (req, res, next) => {
//   try {
//     const { paymentId } = req.params;

//     const payment = await prisma.payment.findUnique({
//       where: { id: paymentId },
//       include: { student: true }
//     });

//     if (!payment) return next(new AppError("Payment not found", 404));

//     // Verify payment belongs to student
//     if (payment.studentId !== req.user.id) {
//       return next(new AppError("Unauthorized: Payment does not belong to this student", 403));
//     }

//     // Build GetEpay payload
//     const returnUrl = buildGatewayReturnOrCallbackUrl(req, "return", payment.id);
//     const callbackUrl = buildGatewayReturnOrCallbackUrl(req, "callback", payment.id);

//     const payload = {
//       mid: process.env.GETEPAY_MID,
//       terminalId: process.env.GETEPAY_TERMINAL_ID,
//       amount: payment.totalAmount.toString(),
//       merchantTransactionId: payment.txnId,
//       transactionDate: moment().format("DD-MM-YYYY HH:mm:ss"),
//       ru: returnUrl,
//       callbackUrl: callbackUrl,
//       currency: "INR",
//       paymentMode: "ALL",
//       txnType: "single",
//       productType: "IPG",
//       txnNote: `Payment for ${payment.student.name} - ${payment.receiptNo}`,
//       udf1: payment.student.phone || "",
//       udf2: payment.student.email || "",
//       udf3: payment.student.name || "",
//       udf4: "",
//       udf5: "",
//       udf6: "",
//       udf7: "",
//       udf8: "",
//       udf9: "",
//       udf10: "",
//       vpa: process.env.GETEPAY_TERMINAL_ID
//     };

//     // Initialize encryption
//     console.log(`🔑 Initializing encryption for payment gateway...`);
//     const enc = new GetEpayEncryption(
//       process.env.GETEPAY_IV,
//       process.env.GETEPAY_KEY,
//       process.env.NODE_ENV === 'production'
//     );

//     const encrypted = await enc.encrypt(JSON.stringify(payload));

//     console.log(`🔐 Encrypted successfully, length: ${encrypted.length}`);
    
//     // 🔴 TEMPORARY DEBUG: Log FULL encrypted request for developer verification
//     console.log(`🔴 [DEBUG] FULL ENCRYPTED REQUEST (studentGeneratePaymentLink):`);
//     console.log(encrypted);
//     console.log(`🔴 [DEBUG] Encrypted length: ${encrypted.length} characters`);
    
//     // Call GetEpay API with proper error handling
//     let response;
//     try {
//       response = await axios.post(process.env.GETEPAY_URL, {
//         mid: process.env.GETEPAY_MID,
//         terminalId: process.env.GETEPAY_TERMINAL_ID,
//         req: encrypted
//       }, {
//         timeout: 60000, // 60 second timeout for production
//         headers: {
//           'Content-Type': 'application/json',
//           'Accept': 'application/json'
//         },
//         validateStatus: function (status) {
//           return status >= 200 && status < 300;
//         },
//         responseType: 'json',
//         maxRedirects: 5,
//         transformResponse: [(data) => {
//           try {
//             if (typeof data === 'string') {
//               if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
//                 console.error('❌ Received HTML response from GetEpay - gateway authentication/authorization failed');
//                 throw new Error('Gateway returned HTML error page - check credentials and endpoint');
//               }
//               return JSON.parse(data);
//             }
//             return data;
//           } catch (e) {
//             console.error('❌ Response transformation error:', e.message);
//             throw e;
//           }
//         }]
//       });
//     } catch (axiosError) {
//       console.error('❌ GetEpay API Error in studentGeneratePaymentLink:', {
//         status: axiosError.response?.status,
//         statusText: axiosError.response?.statusText,
//         data: axiosError.response?.data,
//         message: axiosError.message,
//         code: axiosError.code
//       });
      
//       if (axiosError.code === 'ECONNABORTED') {
//         throw new AppError('Payment gateway request timeout. Please try again.', 504);
//       } else if (axiosError.response?.status === 502 || axiosError.response?.status === 503) {
//         throw new AppError('Payment gateway temporarily unavailable. Please try again later.', 502);
//       } else if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
//         throw new AppError('Payment gateway authentication failed. Please contact support.', 502);
//       } else {
//         throw new AppError(`Payment gateway error: ${axiosError.message}`, 502);
//       }
//     }

//     // Check if response is valid
//     if (!response.data || !response.data.response) {
//       console.error('❌ Invalid response from GetEpay');
//       throw new AppError('Invalid response from payment gateway', 502);
//     }

//     // Decrypt response
//     let decrypted;
//     try {
//       const decryptedStr = await enc.decrypt(response.data.response);
//       if (!decryptedStr) {
//         throw new Error('Decryption returned empty string');
//       }
//       decrypted = JSON.parse(decryptedStr);
//     } catch (decryptError) {
//       console.error('❌ Decryption error:', decryptError.message);
//       throw new AppError(`Failed to decrypt payment gateway response: ${decryptError.message}`, 502);
//     }

//     // Update payment with gateway reference
//     await prisma.payment.update({
//       where: { id: paymentId },
//       data: {
//         gateway: "GETEPAY",
//         status: "INITIATED",
//         gatewayPaymentId: decrypted.paymentId?.toString() || null
//       }
//     });

//     res.status(200).json({
//       status: "success",
//       message: "Payment link generated successfully",
//       data: {
//         paymentUrl: decrypted.paymentUrl,
//         paymentId: payment.id,
//         amount: payment.totalAmount
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * STEP 2: Return URL (Browser Redirect after Payment)
//  * This endpoint is called by GetEpay when user completes/cancels payment
//  * GetEpay sends encrypted response in req.body.response
//  */
// exports.paymentReturn = async (req, res, next) => {
//   try {
//     console.log('\n' + '='.repeat(80));
//     console.log('🔄 [RETURN] ===== PAYMENT RETURN RECEIVED =====');
//     console.log('='.repeat(80));
    
//     let paymentId = req.query.paymentId;
//     let txnStatus = "INITIATED";
//     let getepayTxnId = null;
//     let txnAmount = null;

//     // Get encrypted response from GetEpay
//     const encryptedResponse = getEncryptedGatewayResponse(req);
//     console.log('📦 [RETURN] Encrypted response present?', !!encryptedResponse);

//     // Decrypt the response if available
//     if (encryptedResponse) {
//       try {
//         const enc = new GcmPgEncryption(
//           process.env.GETEPAY_IV,
//           process.env.GETEPAY_KEY
//         );

//         console.log('🔐 [RETURN] Decrypting response...');
//         const decryptedData = await enc.decrypt(encryptedResponse);
//         const decrypted = JSON.parse(decryptedData);
        
//         console.log('✅ [RETURN] Decryption successful');
//         console.log('📋 [RETURN] Decrypted data:', JSON.stringify(decrypted, null, 2));

//         if (!isGatewayIdentityValid(decrypted)) {
//           console.error("❌ [RETURN] Gateway identity check failed");
//           return res.redirect(buildProcessingRedirectUrl(null, { error: "invalid_gateway_identity" }));
//         }

//         // Extract payment details from decrypted response
//         const parsedResponse = parseGatewayResponseFields(decrypted);
//         txnStatus = parsedResponse.txnStatus || "INITIATED";
//         getepayTxnId = parsedResponse.getepayTxnId;
//         txnAmount = parseCurrencyAmount(parsedResponse.txnAmount);
        
//         // If paymentId not in query, try to get it from merchantOrderNo (txnId)
//         if (!paymentId && decrypted.merchantOrderNo) {
//           const payment = await prisma.payment.findUnique({
//             where: { txnId: decrypted.merchantOrderNo },
//             select: { id: true }
//           });
//           if (payment) {
//             paymentId = payment.id;
//             console.log('✅ [RETURN] Found payment by merchantOrderNo:', paymentId);
//           }
//         }
//       } catch (decryptError) {
//         console.warn("⚠️  [RETURN] Decryption failed:", decryptError.message);
//       }
//     }

//     // Update payment status in database
//     if (paymentId && (txnStatus === GATEWAY_SUCCESS || txnStatus === GATEWAY_FAILED)) {
//       try {
//         console.log(`📝 [RETURN] Updating payment ${paymentId} to status: ${txnStatus}`);
        
//         const payment = await prisma.payment.findUnique({
//           where: { id: paymentId },
//           select: { id: true, status: true, totalAmount: true, admissionId: true, receiptUrl: true }
//         });

//         if (payment) {
//           const nextStatus = resolveInternalPaymentStatus(txnStatus);
//           const expectedAmount = parseCurrencyAmount(payment.totalAmount);

//           if (isAmountMismatch(expectedAmount, txnAmount)) {
//             console.error(
//               `❌ [RETURN] Amount mismatch. expected=${expectedAmount} received=${txnAmount}`
//             );
//           } else if (shouldApplyStatusUpdate(payment.status, nextStatus) && payment.status !== nextStatus) {
//             await prisma.payment.update({
//               where: { id: paymentId },
//               data: {
//                 status: nextStatus,
//                 referenceNo: getepayTxnId || undefined,
//                 bankTxnNo: getepayTxnId || undefined
//               }
//             });

//             console.log(`✅ [RETURN] Payment status updated to: ${nextStatus}`);

//             if (nextStatus === "SUCCESS" && payment.admissionId) {
//               await prisma.admission.update({
//                 where: { id: payment.admissionId },
//                 data: { status: "CONFIRMED" }
//               });
//               console.log(`✅ [RETURN] Admission status confirmed`);
//             }

//           }

//           if (nextStatus === "SUCCESS" && !payment.receiptUrl) {
//             console.log(`📄 [RETURN] Queueing receipt/certificate generation...`);
//             triggerReceiptGenerationAsync(payment.id, "RETURN");
//           }
//         }
//       } catch (updateError) {
//         console.warn("⚠️  [RETURN] Failed to update payment:", updateError.message);
//       }
//     }

//     // Redirect to frontend payment processing page
//     if (!paymentId) {
//       console.error('❌ [RETURN] No payment ID found');
//       return res.redirect(buildProcessingRedirectUrl(null, { error: "payment_not_found" }));
//     }

//     let redirectStatus = txnStatus || "INITIATED";

//     // If gateway return payload was missing/failed, derive status from DB to avoid INITIATED loops.
//     if (paymentId && redirectStatus === "INITIATED") {
//       const latestPayment = await prisma.payment.findUnique({
//         where: { id: paymentId },
//         select: { status: true }
//       });
//       if (latestPayment?.status) {
//         redirectStatus = latestPayment.status;
//       }
//     }

//     const redirectUrl = buildProcessingRedirectUrl(paymentId, {
//       status: redirectStatus
//     });
//     console.log(`✅ [RETURN] Redirecting to: ${redirectUrl}`);
//     res.redirect(redirectUrl);

//   } catch (error) {
//     console.error(`❌ [RETURN] Error:`, error.message);
//     console.error('Stack:', error.stack);
//     res.redirect(buildProcessingRedirectUrl(null, { error: "server_error" }));
//   }
// };

// /**
//  * STEP 3: Callback URL (SERVER → SERVER via POST)
//  * GetEpay sends encrypted payment response here after payment completion
//  * 
//  * This handles the response as per GetEpay documentation Section 11-13
//  * Response contains: txnStatus (SUCCESS/FAILED), merchantOrderNo (our txnId), amounts, etc.
//  */
// exports.paymentCallback = async (req, res, next) => {
//   try {
//     console.log('\n' + '='.repeat(80));
//     console.log('🔔 [CALLBACK] ===== GETEPAY CALLBACK RECEIVED =====');
//     console.log('='.repeat(80));
    
//     const encryptedResponse = getEncryptedGatewayResponse(req);

//     // Check if response is present
//     if (!encryptedResponse) {
//       console.error('❌ [CALLBACK] Missing encrypted response in body');
//       console.error('📦 [CALLBACK] Received body:', JSON.stringify(req.body, null, 2));
//       return res.status(400).json({ 
//         status: 'error', 
//         message: 'Missing encrypted response' 
//       });
//     }

//     console.log('📦 [CALLBACK] Received encrypted response (first 100 chars):', 
//       encryptedResponse.substring(0, 100) + '...');

//     // Initialize decryption with GetEpay credentials
//     const enc = new GcmPgEncryption(
//       process.env.GETEPAY_IV,
//       process.env.GETEPAY_KEY
//     );

//     // Decrypt response from GetEpay
//     console.log('🔐 [CALLBACK] Decrypting response with AES-256-GCM...');
//     let decryptedData;
//     try {
//       decryptedData = await enc.decrypt(encryptedResponse);
//       console.log('✅ [CALLBACK] Decryption successful');
//     } catch (decryptError) {
//       console.error('❌ [CALLBACK] Decryption failed:', decryptError.message);
//       return res.status(400).json({ 
//         status: 'error', 
//         message: 'Decryption failed: ' + decryptError.message 
//       });
//     }

//     // Parse decrypted JSON
//     let decrypted;
//     try {
//       decrypted = JSON.parse(decryptedData);
//       console.log('✅ [CALLBACK] JSON parsed successfully');
//     } catch (parseError) {
//       console.error('❌ [CALLBACK] JSON parse failed:', parseError.message);
//       console.error('📦 [CALLBACK] Decrypted content:', decryptedData);
//       return res.status(400).json({ 
//         status: 'error', 
//         message: 'Invalid JSON response' 
//       });
//     }

//     console.log('📋 [CALLBACK] Decrypted Response Data:');
//     console.log(JSON.stringify(decrypted, null, 2));

//     if (!isGatewayIdentityValid(decrypted)) {
//       console.error('❌ [CALLBACK] Gateway identity check failed');
//       return res.status(403).json({
//         status: 'error',
//         message: 'Invalid gateway identity'
//       });
//     }

//     // Extract key fields from GetEpay response
//     // According to GetEpay doc Section 12, response contains:
//     // - txnStatus: SUCCESS/FAILED
//     // - merchantOrderNo: Our transaction ID
//     // - getepayTxnId: GetEpay's transaction ID
//     // - txnAmount: Amount paid
//     // - paymentMode: DC/NEFT/UPI/etc
//     // - txnDate: Transaction date

//     const {
//       merchantTxnId,
//       txnStatus,
//       getepayTxnId,
//       paymentMode,
//       txnDate,
//       txnAmount,
//       errorMessage
//     } = parseGatewayResponseFields(decrypted);

//     console.log('🔍 [CALLBACK] Extracted Fields:');
//     console.log(`  ├─ Merchant Txn ID: ${merchantTxnId}`);
//     console.log(`  ├─ Status: ${txnStatus}`);
//     console.log(`  ├─ GetEpay Txn ID: ${getepayTxnId}`);
//     console.log(`  ├─ Amount: ${txnAmount}`);
//     console.log(`  ├─ Mode: ${paymentMode}`);
//     console.log(`  └─ Date: ${txnDate}`);

//     // Validate transaction ID exists
//     if (!merchantTxnId) {
//       console.error('❌ [CALLBACK] Missing merchantOrderNo in response');
//       return res.status(400).json({ 
//         status: 'error', 
//         message: 'Missing merchantOrderNo in response' 
//       });
//     }

//     // Find payment by our transaction ID
//     console.log(`\n🔍 [CALLBACK] Finding payment with txnId: ${merchantTxnId}`);
//     const payment = await prisma.payment.findUnique({
//       where: { txnId: merchantTxnId },
//       include: {
//         student: true,
//         admission: true,
//         breakups: true
//       }
//     });

//     if (!payment) {
//       console.error(`❌ [CALLBACK] Payment not found for txnId: ${merchantTxnId}`);
//       return res.status(400).json({ 
//         status: 'error', 
//         message: `Payment not found for transaction: ${merchantTxnId}` 
//       });
//     }

//     console.log(`✅ [CALLBACK] Payment found: ${payment.id}`);
//     console.log(`  ├─ Student: ${payment.student?.name}`);
//     console.log(`  ├─ Amount: ₹${payment.totalAmount}`);
//     console.log(`  └─ Current Status: ${payment.status}`);

//     const expectedAmount = parseCurrencyAmount(payment.totalAmount);
//     const receivedAmount = parseCurrencyAmount(txnAmount);
//     if (isAmountMismatch(expectedAmount, receivedAmount)) {
//       console.error(
//         `❌ [CALLBACK] Amount mismatch. expected=${expectedAmount} received=${receivedAmount}`
//       );
//       return res.status(400).json({
//         status: "error",
//         message: "Amount mismatch in gateway callback"
//       });
//     }

//     const nextStatus = resolveInternalPaymentStatus(txnStatus);
//     if (!shouldApplyStatusUpdate(payment.status, nextStatus)) {
//       console.log(
//         `ℹ️ [CALLBACK] Ignoring status downgrade ${payment.status} -> ${nextStatus}`
//       );
//       return res.status(200).json({
//         status: "success",
//         message: "Callback received (ignored as non-progressive update)",
//         paymentId: payment.id
//       });
//     }

//     if (payment.status === nextStatus) {
//       console.log(`ℹ️ [CALLBACK] Idempotent callback (status already ${nextStatus})`);
//       return res.status(200).json({
//         status: "success",
//         message: "Callback already processed",
//         paymentId: payment.id
//       });
//     }

//     // ========== HANDLE SUCCESS ==========
//     if (txnStatus === GATEWAY_SUCCESS) {
//       console.log(`\n💰 [CALLBACK] ===== PAYMENT SUCCESSFUL =====`);
//       console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
//       console.log(`  Payment Mode: ${paymentMode}`);

//       // Update payment with success details
//       const updateData = {
//         status: "SUCCESS",
//         referenceNo: getepayTxnId || payment.referenceNo || null,
//         bankTxnNo: getepayTxnId || payment.bankTxnNo || null
//       };

//       console.log(`\n📝 [CALLBACK] Updating payment status to SUCCESS...`);
//       const updatedPayment = await prisma.payment.update({
//         where: { id: payment.id },
//         data: updateData
//       });
      
//       console.log(`✅ [CALLBACK] Payment status updated to SUCCESS`);
//       console.log(`  ├─ ID: ${updatedPayment.id}`);
//       console.log(`  ├─ Status: ${updatedPayment.status}`);
//       console.log(`  └─ Reference: ${updatedPayment.referenceNo}`);

//       // Update admission status if linked
//       if (payment.admissionId) {
//         console.log(`\n📋 [CALLBACK] Updating admission status...`);
//         await prisma.admission.update({
//           where: { id: payment.admissionId },
//           data: { status: 'CONFIRMED' }
//         });
//         console.log(`✅ [CALLBACK] Admission confirmed`);
//       }

//       // Do not block callback ACK on PDF generation/upload.
//       console.log(`\n📄 [CALLBACK] Queueing receipt and certificate generation...`);
//       triggerReceiptGenerationAsync(payment.id, "CALLBACK");

//       // Log successful payment to audit log
//       try {
//         await prisma.auditLog.create({
//           data: {
//             userId: payment.studentId,
//             action: 'PAYMENT_SUCCESS',
//             entity: 'Payment',
//             entityId: payment.id,
//             payload: JSON.stringify({ 
//               amount: payment.totalAmount,
//               getepayTxnId: getepayTxnId,
//               paymentMode: paymentMode,
//               txnDate: txnDate
//             })
//           }
//         });
//         console.log(`✅ [CALLBACK] Audit log created`);
//       } catch (auditError) {
//         console.warn(`⚠️  [CALLBACK] Audit log creation warning:`, auditError.message);
//       }

//       console.log(`\n✅ [CALLBACK] ===== ALL OPERATIONS COMPLETED SUCCESSFULLY =====\n`);
//       return res.status(200).json({ 
//         status: 'success', 
//         message: 'Payment processed successfully',
//         paymentId: payment.id,
//         getepayTxnId: getepayTxnId
//       });

//     } 
//     // ========== HANDLE FAILURE ==========
//     else if (txnStatus === GATEWAY_FAILED) {
//       console.log(`\n❌ [CALLBACK] ===== PAYMENT FAILED =====`);
//       console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
//       console.log(`  Failure Message: ${errorMessage || 'Unknown error'}`);

//       console.log(`\n📝 [CALLBACK] Updating payment status to FAILED...`);
//       const updatedPayment = await prisma.payment.update({
//         where: { id: payment.id },
//         data: {
//           status: "FAILED",
//           referenceNo: getepayTxnId || payment.referenceNo || null,
//           bankTxnNo: getepayTxnId || payment.bankTxnNo || null
//         }
//       });

//       console.log(`✅ [CALLBACK] Payment status updated to FAILED`);

//       // Log failed payment to audit log
//       try {
//         await prisma.auditLog.create({
//           data: {
//             userId: payment.studentId,
//             action: 'PAYMENT_FAILED',
//             entity: 'Payment',
//             entityId: payment.id,
//             payload: JSON.stringify({ 
//               amount: payment.totalAmount,
//               getepayTxnId: getepayTxnId,
//               error: errorMessage || 'Unknown error',
//               txnDate: txnDate
//             })
//           }
//         });
//         console.log(`✅ [CALLBACK] Audit log created for failure`);
//       } catch (auditError) {
//         console.warn(`⚠️  [CALLBACK] Audit log creation warning:`, auditError.message);
//       }

//       console.log(`\n❌ [CALLBACK] ===== FAILURE PROCESSING COMPLETE =====\n`);
//       return res.status(200).json({ 
//         status: 'failed', 
//         message: 'Payment failed',
//         details: {
//           paymentId: payment.id,
//           txnStatus: txnStatus,
//           error: errorMessage
//         }
//       });
//     }
//     // ========== UNKNOWN STATUS ==========
//     else {
//       console.log(`\n⚠️  [CALLBACK] Unknown transaction status: ${txnStatus}`);
//       console.log(`\n⚠️  [CALLBACK] Updating payment status to PENDING...`);
      
//       await prisma.payment.update({
//         where: { id: payment.id },
//         data: {
//           status: "PENDING",
//           referenceNo: getepayTxnId || null
//         }
//       });

//       console.log(`⚠️  [CALLBACK] ===== UNKNOWN STATUS RECORDED =====\n`);
//       return res.status(200).json({ 
//         status: 'pending', 
//         message: 'Payment status unknown, marked for review',
//         paymentId: payment.id,
//         txnStatus: txnStatus
//       });
//     }

//   } catch (error) {
//     console.error('\n❌ [CALLBACK] CRITICAL ERROR:', error.message);
//     console.error('Stack:', error.stack);
//     console.log('='.repeat(80) + '\n');
//     next(error);
//   }
// };

// // const prisma = require("../config/prisma");
// // const AppError = require("../utils/error");
// // const {
// //   generatePaymentCSV,
// //   generateSummaryCSV,
// // } = require("../utils/dcr1ReportGenerator");
// // const {
// //   createPayment,
// //   updatePaymentStatus,
// //   refundPayment,
// // } = require("../validation/payment.validation");
// // const axios = require("axios");
// // const moment = require("moment");
// // const qs = require("qs");
// // const fs = require("fs");
// // const GcmPgEncryption = require("../utils/getepayEncrypt");
// // const { generateReceiptAndCertificate } = require("./receipt.controller");
// // const { generateReceiptPDF } = require("../utils/pdfGenerator");

// // const GATEWAY_SUCCESS = "SUCCESS";
// // const GATEWAY_FAILED = "FAILED";

// // const normalizeTxnStatus = (status) => {
// //   if (!status) return "";
// //   return String(status).trim().toUpperCase();
// // };

// // const normalizeEncryptedResponse = (value) => {
// //   if (!value) return null;
// //   const raw = String(value).trim();
// //   // Gateways sometimes post form-urlencoded where '+' becomes space.
// //   return raw.includes(" ") ? raw.replace(/ /g, "+") : raw;
// // };

// // const getEncryptedGatewayResponse = (req) => {
// //   return normalizeEncryptedResponse(
// //     req.body?.response ||
// //       req.body?.resp ||
// //       req.query?.response ||
// //       req.query?.resp ||
// //       null,
// //   );
// // };

// // const parseGatewayResponseFields = (decrypted) => {
// //   return {
// //     merchantTxnId:
// //       decrypted.merchantOrderNo ||
// //       decrypted.merchantTransactionId ||
// //       decrypted.merchantTxnId ||
// //       null,
// //     txnStatus: normalizeTxnStatus(
// //       decrypted.txnStatus || decrypted.paymentStatus || decrypted.status,
// //     ),
// //     getepayTxnId:
// //       decrypted.getepayTxnId ||
// //       decrypted.bankTxnNo ||
// //       decrypted.referenceNo ||
// //       null,
// //     paymentMode: decrypted.paymentMode || null,
// //     txnDate: decrypted.txnDate || null,
// //     txnAmount: decrypted.txnAmount || decrypted.totalAmount || null,
// //     errorMessage: decrypted.message || decrypted.errorMessage || null,
// //   };
// // };

// // const isUsableAbsoluteUrl = (value) => {
// //   if (!value || value === "*" || value === "undefined" || value === "null") {
// //     return false;
// //   }

// //   try {
// //     const parsed = new URL(value);
// //     return parsed.protocol === "http:" || parsed.protocol === "https:";
// //   } catch {
// //     return false;
// //   }
// // };

// // const getPrimaryFrontendBase = () => {
// //   const raw = String(process.env.FRONTEND_URL || "").trim();
// //   const candidates = raw
// //     .split(",")
// //     .map((item) => item.trim())
// //     .filter(Boolean);

// //   const usable = candidates.find(isUsableAbsoluteUrl);
// //   return usable || "http://localhost:5173"; // developement or production ?
// // };

// // const getBackendPublicBase = (req) => {
// //   const configured = String(process.env.BACKEND_PUBLIC_URL || "").trim();
// //   if (isUsableAbsoluteUrl(configured)) {
// //     return configured.replace(/\/+$/, "");
// //   }

// //   if (req?.protocol && req?.get) {
// //     return `${req.protocol}://${req.get("host")}`;
// //   }

// //   return "http://localhost:8080"; // developement or production ?
// // };

// // const buildGatewayReturnOrCallbackUrl = (req, type, paymentId) => {
// //   const envKey =
// //     type === "callback" ? "GETEPAY_CALLBACK_URL" : "GETEPAY_RETURN_URL";
// //   const configured = String(process.env[envKey] || "").trim();
// //   const base = isUsableAbsoluteUrl(configured)
// //     ? configured
// //     : `${getBackendPublicBase(req)}/api/v1/payments/${type === "callback" ? "callback" : "return"}`;

// //   const url = new URL(base);
// //   if (paymentId) {
// //     url.searchParams.set("paymentId", paymentId);
// //   }
// //   return url.toString();
// // };

// // const buildProcessingRedirectUrl = (paymentId, extraQuery = {}) => {
// //   const frontendBase = getPrimaryFrontendBase();
// //   const hasProcessingPath = /\/payment-processing\/?$/.test(frontendBase);
// //   const redirectBase = hasProcessingPath
// //     ? frontendBase
// //     : `${frontendBase.replace(/\/+$/, "")}/payment-processing`;

// //   const redirectUrl = new URL(redirectBase);

// //   if (paymentId) {
// //     redirectUrl.searchParams.set("paymentId", paymentId);
// //   }

// //   Object.entries(extraQuery).forEach(([key, value]) => {
// //     if (value !== undefined && value !== null && value !== "") {
// //       redirectUrl.searchParams.set(key, String(value));
// //     }
// //   });

// //   return redirectUrl.toString();
// // };

// // const parseCurrencyAmount = (value) => {
// //   if (value === undefined || value === null) return null;
// //   const cleaned = String(value).replace(/,/g, "").trim();
// //   const amount = Number(cleaned);
// //   return Number.isFinite(amount) ? amount : null;
// // };

// // const isAmountMismatch = (expected, received, tolerance = 0.01) => {
// //   if (!Number.isFinite(expected) || !Number.isFinite(received)) return false;
// //   return Math.abs(expected - received) > tolerance;
// // };

// // const statusPriority = {
// //   PENDING: 0,
// //   INITIATED: 1,
// //   FAILED: 2,
// //   SUCCESS: 3,
// //   REFUNDED: 4,
// // };

// // const shouldApplyStatusUpdate = (currentStatus, nextStatus) => {
// //   const current = statusPriority[currentStatus] ?? -1;
// //   const next = statusPriority[nextStatus] ?? -1;
// //   return next >= current;
// // };

// // const resolveInternalPaymentStatus = (gatewayStatus) => {
// //   if (gatewayStatus === GATEWAY_SUCCESS) return "SUCCESS";
// //   if (gatewayStatus === GATEWAY_FAILED) return "FAILED";
// //   return "PENDING";
// // };

// // const isGatewayIdentityValid = (decrypted) => {
// //   const configuredMid = String(process.env.GETEPAY_MID || "").trim();
// //   const configuredTerminal = String(
// //     process.env.GETEPAY_TERMINAL_ID || "",
// //   ).trim();

// //   const responseMid =
// //     decrypted?.mid || decrypted?.merchantId || decrypted?.merchantCode || "";
// //   const responseTerminal = decrypted?.terminalId || decrypted?.terminal || "";

// //   const midMatches =
// //     !responseMid ||
// //     !configuredMid ||
// //     String(responseMid).trim() === configuredMid;
// //   const terminalMatches =
// //     !responseTerminal ||
// //     !configuredTerminal ||
// //     String(responseTerminal).trim() === configuredTerminal;

// //   return midMatches && terminalMatches;
// // };

// // const triggerReceiptGenerationAsync = (paymentId, source) => {
// //   setImmediate(async () => {
// //     try {
// //       console.log(
// //         `📄 [${source}] Async receipt/certificate generation started for ${paymentId}`,
// //       );
// //       await generateReceiptAndCertificate(paymentId);
// //       console.log(
// //         `✅ [${source}] Async receipt/certificate generation completed for ${paymentId}`,
// //       );
// //     } catch (err) {
// //       console.warn(
// //         `⚠️  [${source}] Async receipt/certificate generation failed:`,
// //         err.message,
// //       );
// //     }
// //   });
// // };

// // /**
// //  * Create a new payment
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.createPayment = async (req, res, next) => {
// //   try {
// //     // Validate request body
// //     const { error, value } = createPayment.validate(req.body);
// //     if (error) {
// //       return next(
// //         new AppError(error.details.map((d) => d.message).join(", "), 400),
// //       );
// //     }

// //     const {
// //       studentId,
// //       admissionId,
// //       totalAmount,
// //       gateway,
// //       txnId,
// //       referenceNo,
// //       breakups,
// //     } = value;

// //     // For testing: return mock payment if database unavailable
// //     try {
// //       // Check if student exists
// //       const student = await prisma.student.findUnique({
// //         where: { id: studentId },
// //       });

// //       if (!student) {
// //         return next(new AppError("Student not found", 404));
// //       }
// //     } catch (dbError) {
// //       console.warn("⚠️  Database unavailable, using mock data for testing");

// //       // Return mock payment for testing
// //       const mockPayment = {
// //         id: `mock-${Date.now()}`,
// //         studentId,
// //         totalAmount,
// //         status: "INITIATED",
// //         gateway: "GETEPAY",
// //         txnId,
// //         receiptNo: `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
// //         student: {
// //           id: studentId,
// //           name: "Test Student",
// //           email: "test@example.com",
// //           reg_no: "TEST-001",
// //         },
// //         breakups: breakups || [{ head: "TUITION", amount: totalAmount }],
// //       };

// //       return res.status(201).json({
// //         status: "success",
// //         message: "Payment initiated successfully (MOCK MODE)",
// //         data: { payment: mockPayment },
// //       });
// //     }

// //     // Check if admission exists (if provided)
// //     let admission = null;
// //     if (admissionId) {
// //       admission = await prisma.admission.findUnique({
// //         where: { id: admissionId },
// //       });

// //       if (!admission) {
// //         return next(new AppError("Admission not found", 404));
// //       }

// //       // Verify that admission belongs to the student
// //       if (admission.studentId !== studentId) {
// //         return next(
// //           new AppError(
// //             "Admission does not belong to the specified student",
// //             400,
// //           ),
// //         );
// //       }
// //     }

// //     // Check if transaction ID already exists
// //     const existingPayment = await prisma.payment.findUnique({
// //       where: { txnId },
// //     });

// //     if (existingPayment) {
// //       return next(
// //         new AppError("Payment with this transaction ID already exists", 400),
// //       );
// //     }

// //     // Generate receipt number
// //     const receiptNo = `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// //     // Create payment in a transaction
// //     const payment = await prisma.$transaction(async (tx) => {
// //       // Create payment
// //       const newPayment = await tx.payment.create({
// //         data: {
// //           studentId,
// //           admissionId: admissionId || null,
// //           totalAmount,
// //           status: "INITIATED",
// //           gateway,
// //           txnId,
// //           referenceNo: referenceNo || null,
// //           receiptNo,
// //         },
// //       });

// //       // Create payment breakups if provided
// //       if (breakups && breakups.length > 0) {
// //         const breakupData = breakups.map((breakup) => ({
// //           paymentId: newPayment.id,
// //           head: breakup.head,
// //           amount: breakup.amount,
// //         }));

// //         await tx.paymentBreakup.createMany({
// //           data: breakupData,
// //         });
// //       }

// //       return newPayment;
// //     });

// //     // Fetch complete payment with breakups
// //     const completePayment = await prisma.payment.findUnique({
// //       where: { id: payment.id },
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             email: true,
// //             reg_no: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             status: true,
// //           },
// //         },
// //         breakups: true,
// //       },
// //     });

// //     // Log audit entry (only if user is authenticated)
// //     if (req.user && req.user.id) {
// //       await prisma.auditLog.create({
// //         data: {
// //           userId: req.user.id,
// //           action: "CREATE_PAYMENT",
// //           entity: "Payment",
// //           entityId: payment.id,
// //           payload: JSON.stringify({
// //             studentId,
// //             admissionId,
// //             totalAmount,
// //             gateway,
// //             txnId,
// //           }),
// //         },
// //       });
// //     }

// //     res.status(201).json({
// //       status: "success",
// //       message: "Payment initiated successfully",
// //       data: {
// //         payment: completePayment,
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Get all payments with filtering options
// //  * Access: ADMIN, ACCOUNTANT, HOD
// //  */
// // exports.getAllPayments = async (req, res, next) => {
// //   try {
// //     const { status, studentId, admissionId } = req.query;

// //     // Build where clause
// //     const where = {};

// //     if (status) {
// //       where.status = status;
// //     }

// //     if (studentId) {
// //       where.studentId = studentId;
// //     }

// //     if (admissionId) {
// //       where.admissionId = admissionId;
// //     }

// //     // Get payments
// //     const payments = await prisma.payment.findMany({
// //       where,
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             email: true,
// //             reg_no: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             status: true,
// //           },
// //         },
// //         breakups: true,
// //       },
// //       orderBy: {
// //         createdAt: "desc",
// //       },
// //     });

// //     res.status(200).json({
// //       status: "success",
// //       results: payments.length,
// //       data: {
// //         payments,
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Get payment by ID
// //  * Access: ADMIN, ACCOUNTANT, HOD
// //  */
// // exports.getPayment = async (req, res, next) => {
// //   try {
// //     const { id } = req.params;

// //     const payment = await prisma.payment.findUnique({
// //       where: { id },
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             reg_no: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             status: true,
// //           },
// //         },
// //         breakups: true,
// //       },
// //     });

// //     if (!payment) {
// //       return next(new AppError("Payment not found", 404));
// //     }

// //     if (payment.status === "SUCCESS") {
// //       payment.invoiceUrl =
// //         payment.receiptUrl ||
// //         `${getBackendPublicBase(req)}/api/v1/payments/public/${payment.id}/invoice`;
// //     }

// //     res.status(200).json({
// //       status: "success",
// //       data: {
// //         payment,
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Download/preview invoice PDF (public)
// //  * Access: Public by payment id (UUID); only for SUCCESS payments
// //  */
// // exports.downloadPublicInvoice = async (req, res, next) => {
// //   try {
// //     const { id } = req.params;

// //     const payment = await prisma.payment.findUnique({
// //       where: { id },
// //       include: {
// //         student: true,
// //         breakups: true,
// //       },
// //     });

// //     if (!payment) {
// //       return next(new AppError("Payment not found", 404));
// //     }

// //     if (payment.status !== "SUCCESS") {
// //       return next(
// //         new AppError("Invoice available only for successful payments", 400),
// //       );
// //     }

// //     // Fast path: if receipt was already uploaded, redirect to persisted file.
// //     if (payment.receiptUrl) {
// //       return res.redirect(payment.receiptUrl);
// //     }

// //     const receiptPath = await generateReceiptPDF(payment);

// //     res.setHeader("Content-Type", "application/pdf");
// //     res.setHeader(
// //       "Content-Disposition",
// //       `inline; filename="Invoice-${payment.receiptNo}.pdf"`,
// //     );

// //     const stream = fs.createReadStream(receiptPath);
// //     stream.on("error", (err) => next(err));
// //     stream.on("close", () => {
// //       fs.promises.unlink(receiptPath).catch(() => {});
// //     });
// //     stream.pipe(res);
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Update payment status
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.updatePaymentStatus = async (req, res, next) => {
// //   try {
// //     const { id } = req.params;

// //     // Validate request body
// //     const { error, value } = updatePaymentStatus.validate(req.body);
// //     if (error) {
// //       return next(
// //         new AppError(error.details.map((d) => d.message).join(", "), 400),
// //       );
// //     }

// //     const { status, notes } = value;

// //     // Get current payment
// //     const payment = await prisma.payment.findUnique({
// //       where: { id },
// //     });

// //     if (!payment) {
// //       return next(new AppError("Payment not found", 404));
// //     }

// //     // Validate status transition
// //     const validTransitions = {
// //       INITIATED: ["SUCCESS", "FAILED"],
// //       SUCCESS: ["REFUNDED"],
// //       FAILED: [],
// //       REFUNDED: [],
// //     };

// //     // Check if current status allows transition to new status
// //     const allowedTransitions = validTransitions[payment.status] || [];

// //     if (!allowedTransitions.includes(status)) {
// //       return next(
// //         new AppError(
// //           `Invalid status transition from ${payment.status} to ${status}`,
// //           400,
// //         ),
// //       );
// //     }

// //     // Update payment status
// //     const updatedPayment = await prisma.payment.update({
// //       where: { id },
// //       data: {
// //         status,
// //       },
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             email: true,
// //             reg_no: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             status: true,
// //           },
// //         },
// //         breakups: true,
// //       },
// //     });

// //     // If payment is successful and linked to an admission, update admission status
// //     if (status === "SUCCESS" && payment.admissionId) {
// //       await prisma.admission.update({
// //         where: { id: payment.admissionId },
// //         data: { status: "CONFIRMED" },
// //       });
// //     }

// //     // Log audit entry
// //     await prisma.auditLog.create({
// //       data: {
// //         userId: req.user.id,
// //         action: "UPDATE_PAYMENT_STATUS",
// //         entity: "Payment",
// //         entityId: id,
// //         payload: JSON.stringify({
// //           fromStatus: payment.status,
// //           toStatus: status,
// //           notes,
// //         }),
// //       },
// //     });

// //     res.status(200).json({
// //       status: "success",
// //       message: "Payment status updated successfully",
// //       data: {
// //         payment: updatedPayment,
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Refund a payment
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.refundPayment = async (req, res, next) => {
// //   try {
// //     const { id } = req.params;

// //     // Validate request body
// //     const { error, value } = refundPayment.validate(req.body);
// //     if (error) {
// //       return next(
// //         new AppError(error.details.map((d) => d.message).join(", "), 400),
// //       );
// //     }

// //     const { reason, refundAmount } = value;

// //     // Get current payment
// //     const payment = await prisma.payment.findUnique({
// //       where: { id },
// //     });

// //     if (!payment) {
// //       return next(new AppError("Payment not found", 404));
// //     }

// //     // Check if payment can be refunded
// //     if (payment.status !== "SUCCESS") {
// //       return next(
// //         new AppError("Only successful payments can be refunded", 400),
// //       );
// //     }

// //     // Check if payment is already refunded
// //     if (payment.status === "REFUNDED") {
// //       return next(new AppError("Payment is already refunded", 400));
// //     }

// //     // Update payment status to REFUNDED
// //     const updatedPayment = await prisma.payment.update({
// //       where: { id },
// //       data: {
// //         status: "REFUNDED",
// //       },
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             email: true,
// //             reg_no: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             status: true,
// //           },
// //         },
// //         breakups: true,
// //       },
// //     });

// //     // Create refund record (in a real implementation, this would integrate with payment gateway)
// //     const refund = await prisma.$transaction(async (tx) => {
// //       // Create refund record
// //       const refundRecord = await tx.refund.create({
// //         data: {
// //           paymentId: id,
// //           amount: refundAmount || payment.totalAmount,
// //           reason,
// //           refundedById: req.user.id,
// //           refundedAt: new Date(),
// //         },
// //       });

// //       return refundRecord;
// //     });

// //     // Log audit entry
// //     await prisma.auditLog.create({
// //       data: {
// //         userId: req.user.id,
// //         action: "REFUND_PAYMENT",
// //         entity: "Payment",
// //         entityId: id,
// //         payload: JSON.stringify({
// //           refundAmount: refundAmount || payment.totalAmount,
// //           reason,
// //         }),
// //       },
// //     });

// //     res.status(200).json({
// //       status: "success",
// //       message: "Payment refunded successfully",
// //       data: {
// //         payment: updatedPayment,
// //         refund,
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Get DCR1 - Daily Collection Report
// //  * Returns:
// //  * - Total admission payment collection (all-time)
// //  * - This month's admission payment collection
// //  * - Today's admission payment collection
// //  *
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.getDCR1Report = async (req, res, next) => {
// //   try {
// //     const now = new Date();

// //     // Start of today (midnight)
// //     const startOfToday = new Date(
// //       now.getFullYear(),
// //       now.getMonth(),
// //       now.getDate(),
// //     );

// //     // Start of this month (1st day at midnight)
// //     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

// //     // End of today (just before midnight)
// //     const endOfToday = new Date(startOfToday);
// //     endOfToday.setDate(endOfToday.getDate() + 1);

// //     // Get total admission payment collection (all-time SUCCESS payments linked to admissions)
// //     const totalCollection = await prisma.payment.aggregate({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null }, // Only admission-linked payments
// //       },
// //       _sum: {
// //         totalAmount: true,
// //       },
// //       _count: true,
// //     });

// //     // Get this month's admission payment collection
// //     const monthCollection = await prisma.payment.aggregate({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: startOfMonth,
// //           lt: endOfToday, // Up to now
// //         },
// //       },
// //       _sum: {
// //         totalAmount: true,
// //       },
// //       _count: true,
// //     });

// //     // Get today's admission payment collection
// //     const todayCollection = await prisma.payment.aggregate({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: startOfToday,
// //           lt: endOfToday,
// //         },
// //       },
// //       _sum: {
// //         totalAmount: true,
// //       },
// //       _count: true,
// //     });

// //     // Get detailed breakdown for today's collections
// //     const todayPaymentsDetail = await prisma.payment.findMany({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: startOfToday,
// //           lt: endOfToday,
// //         },
// //       },
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             reg_no: true,
// //             email: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             admissionNo: true,
// //             course: {
// //               select: {
// //                 id: true,
// //                 name: true,
// //                 code: true,
// //               },
// //             },
// //           },
// //         },
// //         breakups: true,
// //       },
// //       orderBy: {
// //         createdAt: "desc",
// //       },
// //     });

// //     // Get detailed breakdown for this month's collections
// //     const monthPaymentsDetail = await prisma.payment.findMany({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: startOfMonth,
// //           lt: endOfToday,
// //         },
// //       },
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             reg_no: true,
// //             email: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             admissionNo: true,
// //             course: {
// //               select: {
// //                 id: true,
// //                 name: true,
// //                 code: true,
// //               },
// //             },
// //           },
// //         },
// //         breakups: true,
// //       },
// //       orderBy: {
// //         createdAt: "desc",
// //       },
// //       take: 100, // Limit to recent 100 transactions for performance
// //     });

// //     // Format the report
// //     const dcr1Report = {
// //       reportDate: now.toISOString(),
// //       reportType: "DCR1 - Daily Collection Report",
// //       summary: {
// //         totalCollection: {
// //           amount: totalCollection._sum.totalAmount || 0,
// //           count: totalCollection._count || 0,
// //           period: "All Time",
// //         },
// //         monthCollection: {
// //           amount: monthCollection._sum.totalAmount || 0,
// //           count: monthCollection._count || 0,
// //           period: `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`,
// //           startDate: startOfMonth.toISOString(),
// //           endDate: now.toISOString(),
// //         },
// //         todayCollection: {
// //           amount: todayCollection._sum.totalAmount || 0,
// //           count: todayCollection._count || 0,
// //           period: "Today",
// //           date: startOfToday.toISOString(),
// //         },
// //       },
// //       details: {
// //         todayPayments: todayPaymentsDetail,
// //         monthPayments: monthPaymentsDetail,
// //       },
// //     };

// //     res.status(200).json({
// //       status: "success",
// //       message: "DCR1 report generated successfully",
// //       data: {
// //         report: dcr1Report,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("Error generating DCR1 report:", error.message);
// //     next(error);
// //   }
// // };

// // /**
// //  * Get DCR1 Report with Date Range Filter
// //  * Returns:
// //  * - Total collection within date range
// //  * - Transaction details within date range
// //  * - CSV export option
// //  * - Summary statistics
// //  *
// //  * Query Params:
// //  * - startDate: Start date (ISO format: YYYY-MM-DD)
// //  * - endDate: End date (ISO format: YYYY-MM-DD)
// //  * - format: 'json' or 'csv' (default: 'json')
// //  *
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.getDCR1ReportWithDateRange = async (req, res, next) => {
// //   try {
// //     const { startDate, endDate, format } = req.query;

// //     // Parse dates
// //     const start = new Date(startDate);
// //     const end = new Date(endDate);

// //     // Set start to beginning of day
// //     start.setHours(0, 0, 0, 0);

// //     // Set end to end of day
// //     end.setHours(23, 59, 59, 999);

// //     // Validate date range
// //     if (isNaN(start.getTime()) || isNaN(end.getTime())) {
// //       return next(
// //         new AppError("Invalid date format. Use ISO format (YYYY-MM-DD)", 400),
// //       );
// //     }

// //     if (start > end) {
// //       return next(new AppError("Start date cannot be after end date", 400));
// //     }

// //     // Limit range to max 1 year for performance
// //     const diffTime = Math.abs(end - start);
// //     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

// //     if (diffDays > 365) {
// //       return next(new AppError("Date range cannot exceed 365 days", 400));
// //     }

// //     // Get total collection within date range
// //     const rangeCollection = await prisma.payment.aggregate({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: start,
// //           lte: end,
// //         },
// //       },
// //       _sum: {
// //         totalAmount: true,
// //       },
// //       _count: true,
// //     });

// //     // Get all detailed transactions within date range
// //     const paymentsDetail = await prisma.payment.findMany({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: start,
// //           lte: end,
// //         },
// //       },
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             reg_no: true,
// //             email: true,
// //           },
// //         },
// //         admission: {
// //           select: {
// //             id: true,
// //             admissionNo: true,
// //             course: {
// //               select: {
// //                 id: true,
// //                 name: true,
// //                 code: true,
// //               },
// //             },
// //           },
// //         },
// //         breakups: true,
// //       },
// //       orderBy: {
// //         createdAt: "desc",
// //       },
// //     });

// //     // Calculate summary
// //     const totalAmount = rangeCollection._sum.totalAmount || 0;
// //     const totalCount = rangeCollection._count || 0;
// //     const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

// //     // Prepare summary object
// //     const summary = {
// //       totalCollection: {
// //         amount: Number(totalAmount),
// //         count: totalCount,
// //         period: `${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`,
// //         startDate: start.toISOString(),
// //         endDate: end.toISOString(),
// //       },
// //       averageTransaction: {
// //         amount: Number(averageAmount.toFixed(2)),
// //         description: "Average per transaction",
// //       },
// //     };

// //     // If CSV format requested
// //     if (format === "csv") {
// //       const { csvData, fileName } = generatePaymentCSV(paymentsDetail);

// //       // Add summary at the end of CSV
// //       const summaryCSV = generateSummaryCSV(summary, start, end);
// //       const finalCSV = csvData + "\n\n" + summaryCSV;

// //       res.setHeader("Content-Type", "text/csv");
// //       res.setHeader(
// //         "Content-Disposition",
// //         `attachment; filename="${fileName}"`,
// //       );

// //       return res.send(finalCSV);
// //     }

// //     // Format the JSON report
// //     const dcr1Report = {
// //       reportType: "DCR1 - Date Range Collection Report",
// //       generatedAt: new Date().toISOString(),
// //       dateRange: {
// //         startDate: start.toISOString(),
// //         endDate: end.toISOString(),
// //         formattedRange: `${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`,
// //         totalDays: diffDays,
// //       },
// //       summary: summary,
// //       statistics: {
// //         totalTransactions: totalCount,
// //         successfulAmount: Number(totalAmount),
// //         averageTransactionValue: Number(averageAmount.toFixed(2)),
// //         highestTransaction:
// //           paymentsDetail.length > 0
// //             ? Math.max(...paymentsDetail.map((p) => Number(p.totalAmount)))
// //             : 0,
// //         lowestTransaction:
// //           paymentsDetail.length > 0
// //             ? Math.min(...paymentsDetail.map((p) => Number(p.totalAmount)))
// //             : 0,
// //       },
// //       transactions: paymentsDetail,
// //       downloadLinks: {
// //         csv: `/api/v1/payments/dcr1-report/date-range?startDate=${startDate}&endDate=${endDate}&format=csv`,
// //       },
// //     };

// //     res.status(200).json({
// //       status: "success",
// //       message: `DCR1 report generated for ${diffDays + 1} days`,
// //       data: {
// //         report: dcr1Report,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("Error generating DCR1 date range report:", error.message);
// //     next(error);
// //   }
// // };

// // /**
// //  * Get Today's Collection Summary
// //  * Quick endpoint for today's collection only
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.getTodayCollection = async (req, res, next) => {
// //   try {
// //     const now = new Date();
// //     const startOfToday = new Date(
// //       now.getFullYear(),
// //       now.getMonth(),
// //       now.getDate(),
// //     );
// //     const endOfToday = new Date(startOfToday);
// //     endOfToday.setDate(endOfToday.getDate() + 1);

// //     const todayCollection = await prisma.payment.aggregate({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: startOfToday,
// //           lt: endOfToday,
// //         },
// //       },
// //       _sum: {
// //         totalAmount: true,
// //       },
// //       _count: true,
// //     });

// //     res.status(200).json({
// //       status: "success",
// //       data: {
// //         today: {
// //           amount: Number(todayCollection._sum.totalAmount || 0),
// //           count: todayCollection._count || 0,
// //           date: startOfToday.toISOString(),
// //         },
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Get Month's Collection Summary
// //  * Quick endpoint for current month's collection only
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.getMonthCollection = async (req, res, next) => {
// //   try {
// //     const now = new Date();
// //     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
// //     const endOfMonth = new Date(
// //       now.getFullYear(),
// //       now.getMonth() + 1,
// //       0,
// //       23,
// //       59,
// //       59,
// //       999,
// //     );

// //     const monthCollection = await prisma.payment.aggregate({
// //       where: {
// //         status: "SUCCESS",
// //         admissionId: { not: null },
// //         createdAt: {
// //           gte: startOfMonth,
// //           lte: endOfMonth,
// //         },
// //       },
// //       _sum: {
// //         totalAmount: true,
// //       },
// //       _count: true,
// //     });

// //     res.status(200).json({
// //       status: "success",
// //       data: {
// //         month: {
// //           amount: Number(monthCollection._sum.totalAmount || 0),
// //           count: monthCollection._count || 0,
// //           startDate: startOfMonth.toISOString(),
// //           endDate: endOfMonth.toISOString(),
// //           monthName: now.toLocaleString("default", { month: "long" }),
// //           year: now.getFullYear(),
// //         },
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * Get payment statistics
// //  * Access: ADMIN, ACCOUNTANT, HOD
// //  */
// // exports.getPaymentStats = async (req, res, next) => {
// //   try {
// //     // Get payment statistics
// //     const stats = await prisma.payment.groupBy({
// //       by: ["status"],
// //       _sum: {
// //         totalAmount: true,
// //       },
// //       _count: true,
// //     });

// //     // Get recent payments
// //     const recentPayments = await prisma.payment.findMany({
// //       take: 10,
// //       include: {
// //         student: {
// //           select: {
// //             id: true,
// //             name: true,
// //             reg_no: true,
// //           },
// //         },
// //       },
// //       orderBy: {
// //         createdAt: "desc",
// //       },
// //     });

// //     res.status(200).json({
// //       status: "success",
// //       data: {
// //         stats,
// //         recentPayments,
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * STEP 1: Generate Payment Link via GetEpay Gateway
// //  * Access: ADMIN, ACCOUNTANT
// //  */
// // exports.generatePaymentLink = async (req, res, next) => {
// //   try {
// //     const { paymentId } = req.params;
// //     console.log(`🔗 Generating payment link for payment: ${paymentId}`);

// //     const payment = await prisma.payment.findUnique({
// //       where: { id: paymentId },
// //       include: { student: true },
// //     });

// //     if (!payment) {
// //       console.error(`❌ Payment not found: ${paymentId}`);
// //       return next(new AppError("Payment not found", 404));
// //     }

// //     console.log(
// //       `✅ Payment found: ${payment.receiptNo}, Amount: ${payment.totalAmount}`,
// //     );

// //     // Build GetEpay payload
// //     const returnUrl = buildGatewayReturnOrCallbackUrl(
// //       req,
// //       "return",
// //       payment.id,
// //     );
// //     const callbackUrl = buildGatewayReturnOrCallbackUrl(
// //       req,
// //       "callback",
// //       payment.id,
// //     );

// //     if (
// //       !process.env.GETEPAY_MID ||
// //       !process.env.GETEPAY_TERMINAL_ID ||
// //       !process.env.GETEPAY_KEY ||
// //       !process.env.GETEPAY_IV
// //     ) {
// //       throw new AppError("GetEpay environment variables not configured", 500);
// //     }

// //     const payload = {
// //       mid: process.env.GETEPAY_MID,
// //       terminalId: process.env.GETEPAY_TERMINAL_ID,
// //       amount: payment.totalAmount.toString(),
// //       merchantTransactionId: payment.txnId,
// //       // transactionDate: new Date().toISOString(),
// //       transactionDate: moment().format("DD-MM-YYYY HH:mm:ss"),
// //       ru: returnUrl,
// //       callbackUrl: callbackUrl,
// //       currency: "INR",
// //       paymentMode: "ALL",
// //       // bankId: "455",
// //       txnType: "single",
// //       // productType: "IPG",
// //       productType: "PAYMENT",
// //       txnNote: `Payment for ${payment.student.name} - ${payment.receiptNo}`,
// //       udf1: payment.student.phone || "",
// //       udf2: payment.student.email || "",
// //       udf3: payment.student.name || "",
// //       udf4: "",
// //       udf5: "",
// //       udf6: "",
// //       udf7: "",
// //       udf8: "",
// //       udf9: "",
// //       udf10: "",
// //     };

// //     console.log(`📦 Payload created, amount: ${payload.amount}`);

// //     // Initialize encryption
// //     console.log(`🔑 IV: ${process.env.GETEPAY_IV ? "Set" : "NULL"}`);
// //     console.log(`🔑 KEY: ${process.env.GETEPAY_KEY ? "Set" : "NULL"}`);

// //     const enc = new GcmPgEncryption(
// //       process.env.GETEPAY_IV,
// //       process.env.GETEPAY_KEY,
// //     );

// //     console.log(`🔐 Encrypting payload...`);
// //     const encrypted = await enc.encrypt(JSON.stringify(payload));
// //     console.log(`✅ Encrypted successfully, length: ${encrypted.length}`);

// //     // Call GetEpay API
// //     console.log(`🚀 Calling GetEpay API at: ${process.env.GETEPAY_URL}`);
// //     console.log(`📤 Request data:`, {
// //       mid: process.env.GETEPAY_MID,
// //       terminalId: process.env.GETEPAY_TERMINAL_ID,
// //       req: encrypted.substring(0, 50) + "...", // Show first 50 chars
// //     });

// //     let response;
// //     try {
// //       // response = await axios.post(process.env.GETEPAY_URL, {
// //       //   mid: process.env.GETEPAY_MID,
// //       //   terminalId: process.env.GETEPAY_TERMINAL_ID,
// //       //   req: encrypted
// //       // }, {
// //       //   timeout: 30000 // 30 second timeout
// //       // });

// //       response = await axios.post(
// //         process.env.GETEPAY_URL,
// //         qs.stringify({
// //           mid: process.env.GETEPAY_MID,
// //           terminalId: process.env.GETEPAY_TERMINAL_ID,
// //           req: encrypted,
// //         }),
// //         {
// //           headers: {
// //             "Content-Type": "application/x-www-form-urlencoded",
// //           },
// //           timeout: 30000,
// //         },
// //       );
// //     } catch (axiosError) {
// //       console.error("❌ GetEpay API Error:", {
// //         status: axiosError.response?.status,
// //         statusText: axiosError.response?.statusText,
// //         data: axiosError.response?.data,
// //         message: axiosError.message,
// //       });
// //       throw new AppError(`GetEpay API error: ${axiosError.message}`, 502);
// //     }

// //     console.log(`✅ GetEpay API response status: ${response.status}`);
// //     console.log(`📥 Full Response object keys:`, Object.keys(response.data));
// //     console.log(
// //       `📥 Complete Response data:`,
// //       JSON.stringify(response.data, null, 2),
// //     );

// //     // Check if GetEpay returned an error
// //     if (response.data.status === "FAILED") {
// //       console.error("❌ GetEpay Error:", response.data.message);
// //       throw new AppError(`GetEpay Error: ${response.data.message}`, 502);
// //     }

// //     // Check if response has the expected structure
// //     if (!response.data) {
// //       console.error("❌ GetEpay response is empty");
// //       throw new AppError("GetEpay returned empty response", 502);
// //     }

// //     console.log(`🔍 Checking for response field...`);
// //     console.log(`   response.data.response exists?`, !!response.data.response);
// //     console.log(`   response.data.resp exists?`, !!response.data.resp);
// //     console.log(
// //       `   response.data.paymentUrl exists?`,
// //       !!response.data.paymentUrl,
// //     );
// //     console.log(`   All data keys:`, Object.keys(response.data));

// //     // if (!response.data.response) {
// //     //   console.error("❌ GetEpay response.data.response is missing");
// //     //   console.error("Available fields:", Object.keys(response.data));
// //     //   throw new AppError(
// //     //     "GetEpay response format invalid - no encrypted response data",
// //     //     502,
// //     //   );
// //     // }

// //     const encryptedGatewayResponse =
// //       response.data.response ||
// //       response.data.resp ||
// //       response.data.data ||
// //       response.data.encryptedResponse ||
// //       null;

// //     if (!encryptedGatewayResponse) {
// //       console.error("❌ Unexpected GetEpay response:", response.data);

// //       throw new AppError(
// //         "GetEpay response format invalid - encrypted payload missing",
// //         502,
// //       );
// //     }

// //     // Decrypt response
// //     // console.log(`🔓 Decrypting response...`);
// //     // let decrypted;
// //     try {
// //       // const decryptedStr = await enc.decrypt(response.data.response);

// //       const decryptedStr = await enc.decrypt(encryptedGatewayResponse);

// //       let decrypted;

// //       try {
// //         decrypted = JSON.parse(decryptedStr);
// //       } catch (err) {
// //         console.error("❌ Decryption JSON parse error:", decryptedStr);
// //         throw new AppError("Invalid decrypted gateway response", 502);
// //       }

// //       if (!decryptedStr) {
// //         throw new Error("Decryption returned empty string");
// //       }
// //       decrypted = JSON.parse(decryptedStr);
// //     } catch (decryptError) {
// //       console.error("❌ Decryption error:", decryptError.message);
// //       throw new AppError(`Decryption failed: ${decryptError.message}`, 502);
// //     }
// //     console.log(`✅ Decrypted response:`, decrypted);

// //     // Update payment with gateway reference
// //     await prisma.payment.update({
// //       where: { id: paymentId },
// //       data: {
// //         gateway: "GETEPAY",
// //         status: "INITIATED",
// //       },
// //     });

// //     // Log audit entry (only if user is authenticated)
// //     if (req.user && req.user.id) {
// //       await prisma.auditLog.create({
// //         data: {
// //           userId: req.user.id,
// //           action: "GENERATE_PAYMENT_LINK",
// //           entity: "Payment",
// //           entityId: paymentId,
// //           payload: JSON.stringify({
// //             amount: payment.totalAmount,
// //             gateway: "GETEPAY",
// //           }),
// //         },
// //       });
// //     }

// //     console.log(`✅ Payment link generated successfully`);

// //     res.status(200).json({
// //       status: "success",
// //       message: "Payment link generated successfully",
// //       data: {
// //         paymentUrl: decrypted.paymentUrl,
// //         paymentId: payment.id,
// //       },
// //     });
// //   } catch (error) {
// //     console.error("❌ Error in generatePaymentLink:", error.message);
// //     console.error("❌ Stack trace:", error.stack);
// //     next(error);
// //   }
// // };

// // /**
// //  * STEP 1B: Generate Payment Link for Students (Student Initiated)
// //  * Access: STUDENT (via token)
// //  */
// // exports.studentGeneratePaymentLink = async (req, res, next) => {
// //   try {
// //     const { paymentId } = req.params;

// //     const payment = await prisma.payment.findUnique({
// //       where: { id: paymentId },
// //       include: { student: true },
// //     });

// //     if (!payment) return next(new AppError("Payment not found", 404));

// //     // Verify payment belongs to student
// //     if (payment.studentId !== req.user.id) {
// //       return next(
// //         new AppError(
// //           "Unauthorized: Payment does not belong to this student",
// //           403,
// //         ),
// //       );
// //     }

// //     // Build GetEpay payload
// //     const returnUrl = buildGatewayReturnOrCallbackUrl(
// //       req,
// //       "return",
// //       payment.id,
// //     );
// //     const callbackUrl = buildGatewayReturnOrCallbackUrl(
// //       req,
// //       "callback",
// //       payment.id,
// //     );

// //     const payload = {
// //       mid: process.env.GETEPAY_MID,
// //       terminalId: process.env.GETEPAY_TERMINAL_ID,
// //       amount: payment.totalAmount.toString(),
// //       merchantTransactionId: payment.txnId,
// //       // transactionDate: new Date().toISOString(),
// //       transactionDate: moment().format("DD-MM-YYYY HH:mm:ss"),
// //       ru: returnUrl,
// //       callbackUrl: callbackUrl,
// //       currency: "INR",
// //       paymentMode: "ALL",
// //       // bankId: "455",
// //       txnType: "single",
// //       // productType: "IPG",
// //       productType: "PAYMENT",
// //       txnNote: `Payment for ${payment.student.name} - ${payment.receiptNo}`,
// //       udf1: payment.student.phone || "",
// //       udf2: payment.student.email || "",
// //       udf3: payment.student.name || "",
// //       udf4: "",
// //       udf5: "",
// //       udf6: "",
// //       udf7: "",
// //       udf8: "",
// //       udf9: "",
// //       udf10: "",
// //     };

// //     // Initialize encryption
// //     const enc = new GcmPgEncryption(
// //       process.env.GETEPAY_IV,
// //       process.env.GETEPAY_KEY,
// //     );

// //     const encrypted = await enc.encrypt(JSON.stringify(payload));

// //     // Call GetEpay API
// //     const response = await axios.post(process.env.GETEPAY_URL, {
// //       mid: process.env.GETEPAY_MID,
// //       terminalId: process.env.GETEPAY_TERMINAL_ID,
// //       req: encrypted,
// //     });

// //     // const response = await axios.post(
// //     //   process.env.GETEPAY_URL,
// //     //   qs.stringify({
// //     //     mid: process.env.GETEPAY_MID,
// //     //     terminalId: process.env.GETEPAY_TERMINAL_ID,
// //     //     req: encrypted
// //     //   }),
// //     //   {
// //     //   headers: {
// //     //     "Content-Type": "application/x-www-form-urlencoded"
// //     //   },
// //     //   timeout: 30000
// //     //   }
// //     // );

// //     // Decrypt response
// //     const decrypted = JSON.parse(await enc.decrypt(response.data.response));

// //     // Update payment with gateway reference
// //     await prisma.payment.update({
// //       where: { id: paymentId },
// //       data: {
// //         gateway: "GETEPAY",
// //         status: "INITIATED",
// //       },
// //     });

// //     res.status(200).json({
// //       status: "success",
// //       message: "Payment link generated successfully",
// //       data: {
// //         paymentUrl: decrypted.paymentUrl,
// //         paymentId: payment.id,
// //         amount: payment.totalAmount,
// //       },
// //     });
// //   } catch (error) {
// //     next(error);
// //   }
// // };

// // /**
// //  * STEP 2: Return URL (Browser Redirect after Payment)
// //  * This endpoint is called by GetEpay when user completes/cancels payment
// //  * GetEpay sends encrypted response in req.body.response
// //  */
// // exports.paymentReturn = async (req, res, next) => {
// //   try {
// //     console.log("\n" + "=".repeat(80));
// //     console.log("🔄 [RETURN] ===== PAYMENT RETURN RECEIVED =====");
// //     console.log("=".repeat(80));

// //     let paymentId = req.query.paymentId;
// //     let txnStatus = "INITIATED";
// //     let getepayTxnId = null;
// //     let txnAmount = null;

// //     // Get encrypted response from GetEpay
// //     const encryptedResponse = getEncryptedGatewayResponse(req);
// //     console.log("📦 [RETURN] Encrypted response present?", !!encryptedResponse);

// //     // Decrypt the response if available
// //     if (encryptedResponse) {
// //       try {
// //         const enc = new GcmPgEncryption(
// //           process.env.GETEPAY_IV,
// //           process.env.GETEPAY_KEY,
// //         );

// //         console.log("🔐 [RETURN] Decrypting response...");
// //         const decryptedData = await enc.decrypt(encryptedResponse);
// //         const decrypted = JSON.parse(decryptedData);

// //         console.log("✅ [RETURN] Decryption successful");
// //         console.log(
// //           "📋 [RETURN] Decrypted data:",
// //           JSON.stringify(decrypted, null, 2),
// //         );

// //         if (!isGatewayIdentityValid(decrypted)) {
// //           console.error("❌ [RETURN] Gateway identity check failed");
// //           return res.redirect(
// //             buildProcessingRedirectUrl(null, {
// //               error: "invalid_gateway_identity",
// //             }),
// //           );
// //         }

// //         // Extract payment details from decrypted response
// //         const parsedResponse = parseGatewayResponseFields(decrypted);
// //         txnStatus = parsedResponse.txnStatus || "INITIATED";
// //         getepayTxnId = parsedResponse.getepayTxnId;
// //         txnAmount = parseCurrencyAmount(parsedResponse.txnAmount);

// //         // If paymentId not in query, try to get it from merchantOrderNo (txnId)
// //         if (!paymentId && decrypted.merchantOrderNo) {
// //           const payment = await prisma.payment.findUnique({
// //             where: { txnId: decrypted.merchantOrderNo },
// //             select: { id: true },
// //           });
// //           if (payment) {
// //             paymentId = payment.id;
// //             console.log(
// //               "✅ [RETURN] Found payment by merchantOrderNo:",
// //               paymentId,
// //             );
// //           }
// //         }
// //       } catch (decryptError) {
// //         console.warn("⚠️  [RETURN] Decryption failed:", decryptError.message);
// //       }
// //     }

// //     // Update payment status in database
// //     if (
// //       paymentId &&
// //       (txnStatus === GATEWAY_SUCCESS || txnStatus === GATEWAY_FAILED)
// //     ) {
// //       try {
// //         console.log(
// //           `📝 [RETURN] Updating payment ${paymentId} to status: ${txnStatus}`,
// //         );

// //         const payment = await prisma.payment.findUnique({
// //           where: { id: paymentId },
// //           select: {
// //             id: true,
// //             status: true,
// //             totalAmount: true,
// //             admissionId: true,
// //             receiptUrl: true,
// //           },
// //         });

// //         if (payment) {
// //           const nextStatus = resolveInternalPaymentStatus(txnStatus);
// //           const expectedAmount = parseCurrencyAmount(payment.totalAmount);

// //           if (isAmountMismatch(expectedAmount, txnAmount)) {
// //             console.error(
// //               `❌ [RETURN] Amount mismatch. expected=${expectedAmount} received=${txnAmount}`,
// //             );
// //           } else if (
// //             shouldApplyStatusUpdate(payment.status, nextStatus) &&
// //             payment.status !== nextStatus
// //           ) {
// //             await prisma.payment.update({
// //               where: { id: paymentId },
// //               data: {
// //                 status: nextStatus,
// //                 referenceNo: getepayTxnId || undefined,
// //                 bankTxnNo: getepayTxnId || undefined,
// //               },
// //             });

// //             console.log(`✅ [RETURN] Payment status updated to: ${nextStatus}`);

// //             if (nextStatus === "SUCCESS" && payment.admissionId) {
// //               await prisma.admission.update({
// //                 where: { id: payment.admissionId },
// //                 data: { status: "CONFIRMED" },
// //               });
// //               console.log(`✅ [RETURN] Admission status confirmed`);
// //             }
// //           }

// //           if (nextStatus === "SUCCESS" && !payment.receiptUrl) {
// //             console.log(
// //               `📄 [RETURN] Queueing receipt/certificate generation...`,
// //             );
// //             triggerReceiptGenerationAsync(payment.id, "RETURN");
// //           }
// //         }
// //       } catch (updateError) {
// //         console.warn(
// //           "⚠️  [RETURN] Failed to update payment:",
// //           updateError.message,
// //         );
// //       }
// //     }

// //     // Redirect to frontend payment processing page
// //     if (!paymentId) {
// //       console.error("❌ [RETURN] No payment ID found");
// //       return res.redirect(
// //         buildProcessingRedirectUrl(null, { error: "payment_not_found" }),
// //       );
// //     }

// //     let redirectStatus = txnStatus || "INITIATED";

// //     // If gateway return payload was missing/failed, derive status from DB to avoid INITIATED loops.
// //     if (paymentId && redirectStatus === "INITIATED") {
// //       const latestPayment = await prisma.payment.findUnique({
// //         where: { id: paymentId },
// //         select: { status: true },
// //       });
// //       if (latestPayment?.status) {
// //         redirectStatus = latestPayment.status;
// //       }
// //     }

// //     const redirectUrl = buildProcessingRedirectUrl(paymentId, {
// //       status: redirectStatus,
// //     });
// //     console.log(`✅ [RETURN] Redirecting to: ${redirectUrl}`);
// //     res.redirect(redirectUrl);
// //   } catch (error) {
// //     console.error(`❌ [RETURN] Error:`, error.message);
// //     console.error("Stack:", error.stack);
// //     res.redirect(buildProcessingRedirectUrl(null, { error: "server_error" }));
// //   }
// // };

// // /**
// //  * STEP 3: Callback URL (SERVER → SERVER via POST)
// //  * GetEpay sends encrypted payment response here after payment completion
// //  *
// //  * This handles the response as per GetEpay documentation Section 11-13
// //  * Response contains: txnStatus (SUCCESS/FAILED), merchantOrderNo (our txnId), amounts, etc.
// //  */
// // exports.paymentCallback = async (req, res, next) => {
// //   try {
// //     console.log("\n" + "=".repeat(80));
// //     console.log("🔔 [CALLBACK] ===== GETEPAY CALLBACK RECEIVED =====");
// //     console.log("=".repeat(80));

// //     const encryptedResponse = getEncryptedGatewayResponse(req);

// //     // Check if response is present
// //     if (!encryptedResponse) {
// //       console.error("❌ [CALLBACK] Missing encrypted response in body");
// //       console.error(
// //         "📦 [CALLBACK] Received body:",
// //         JSON.stringify(req.body, null, 2),
// //       );
// //       return res.status(400).json({
// //         status: "error",
// //         message: "Missing encrypted response",
// //       });
// //     }

// //     console.log(
// //       "📦 [CALLBACK] Received encrypted response (first 100 chars):",
// //       encryptedResponse.substring(0, 100) + "...",
// //     );

// //     // Initialize decryption with GetEpay credentials
// //     const enc = new GcmPgEncryption(
// //       process.env.GETEPAY_IV,
// //       process.env.GETEPAY_KEY,
// //     );

// //     // Decrypt response from GetEpay
// //     console.log("🔐 [CALLBACK] Decrypting response with AES-256-GCM...");
// //     let decryptedData;
// //     try {
// //       decryptedData = await enc.decrypt(encryptedResponse);
// //       console.log("✅ [CALLBACK] Decryption successful");
// //     } catch (decryptError) {
// //       console.error("❌ [CALLBACK] Decryption failed:", decryptError.message);
// //       return res.status(400).json({
// //         status: "error",
// //         message: "Decryption failed: " + decryptError.message,
// //       });
// //     }

// //     // Parse decrypted JSON
// //     let decrypted;
// //     try {
// //       decrypted = JSON.parse(decryptedData);
// //       console.log("✅ [CALLBACK] JSON parsed successfully");
// //     } catch (parseError) {
// //       console.error("❌ [CALLBACK] JSON parse failed:", parseError.message);
// //       console.error("📦 [CALLBACK] Decrypted content:", decryptedData);
// //       return res.status(400).json({
// //         status: "error",
// //         message: "Invalid JSON response",
// //       });
// //     }

// //     console.log("📋 [CALLBACK] Decrypted Response Data:");
// //     console.log(JSON.stringify(decrypted, null, 2));

// //     if (!isGatewayIdentityValid(decrypted)) {
// //       console.error("❌ [CALLBACK] Gateway identity check failed");
// //       return res.status(403).json({
// //         status: "error",
// //         message: "Invalid gateway identity",
// //       });
// //     }

// //     // Extract key fields from GetEpay response
// //     // According to GetEpay doc Section 12, response contains:
// //     // - txnStatus: SUCCESS/FAILED
// //     // - merchantOrderNo: Our transaction ID
// //     // - getepayTxnId: GetEpay's transaction ID
// //     // - txnAmount: Amount paid
// //     // - paymentMode: DC/NEFT/UPI/etc
// //     // - txnDate: Transaction date

// //     const {
// //       merchantTxnId,
// //       txnStatus,
// //       getepayTxnId,
// //       paymentMode,
// //       txnDate,
// //       txnAmount,
// //       errorMessage,
// //     } = parseGatewayResponseFields(decrypted);

// //     console.log("🔍 [CALLBACK] Extracted Fields:");
// //     console.log(`  ├─ Merchant Txn ID: ${merchantTxnId}`);
// //     console.log(`  ├─ Status: ${txnStatus}`);
// //     console.log(`  ├─ GetEpay Txn ID: ${getepayTxnId}`);
// //     console.log(`  ├─ Amount: ${txnAmount}`);
// //     console.log(`  ├─ Mode: ${paymentMode}`);
// //     console.log(`  └─ Date: ${txnDate}`);

// //     // Validate transaction ID exists
// //     if (!merchantTxnId) {
// //       console.error("❌ [CALLBACK] Missing merchantOrderNo in response");
// //       return res.status(400).json({
// //         status: "error",
// //         message: "Missing merchantOrderNo in response",
// //       });
// //     }

// //     // Find payment by our transaction ID
// //     console.log(`\n🔍 [CALLBACK] Finding payment with txnId: ${merchantTxnId}`);
// //     const payment = await prisma.payment.findUnique({
// //       where: { txnId: merchantTxnId },
// //       include: {
// //         student: true,
// //         admission: true,
// //         breakups: true,
// //       },
// //     });

// //     if (!payment) {
// //       console.error(
// //         `❌ [CALLBACK] Payment not found for txnId: ${merchantTxnId}`,
// //       );
// //       return res.status(400).json({
// //         status: "error",
// //         message: `Payment not found for transaction: ${merchantTxnId}`,
// //       });
// //     }

// //     console.log(`✅ [CALLBACK] Payment found: ${payment.id}`);
// //     console.log(`  ├─ Student: ${payment.student?.name}`);
// //     console.log(`  ├─ Amount: ₹${payment.totalAmount}`);
// //     console.log(`  └─ Current Status: ${payment.status}`);

// //     const expectedAmount = parseCurrencyAmount(payment.totalAmount);
// //     const receivedAmount = parseCurrencyAmount(txnAmount);
// //     if (isAmountMismatch(expectedAmount, receivedAmount)) {
// //       console.error(
// //         `❌ [CALLBACK] Amount mismatch. expected=${expectedAmount} received=${receivedAmount}`,
// //       );
// //       return res.status(400).json({
// //         status: "error",
// //         message: "Amount mismatch in gateway callback",
// //       });
// //     }

// //     const nextStatus = resolveInternalPaymentStatus(txnStatus);
// //     if (!shouldApplyStatusUpdate(payment.status, nextStatus)) {
// //       console.log(
// //         `ℹ️ [CALLBACK] Ignoring status downgrade ${payment.status} -> ${nextStatus}`,
// //       );
// //       return res.status(200).json({
// //         status: "success",
// //         message: "Callback received (ignored as non-progressive update)",
// //         paymentId: payment.id,
// //       });
// //     }

// //     if (payment.status === nextStatus) {
// //       console.log(
// //         `ℹ️ [CALLBACK] Idempotent callback (status already ${nextStatus})`,
// //       );
// //       return res.status(200).json({
// //         status: "success",
// //         message: "Callback already processed",
// //         paymentId: payment.id,
// //       });
// //     }

// //     // ========== HANDLE SUCCESS ==========
// //     if (txnStatus === GATEWAY_SUCCESS) {
// //       console.log(`\n💰 [CALLBACK] ===== PAYMENT SUCCESSFUL =====`);
// //       console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
// //       console.log(`  Payment Mode: ${paymentMode}`);

// //       // Update payment with success details
// //       const updateData = {
// //         status: "SUCCESS",
// //         referenceNo: getepayTxnId || payment.referenceNo || null,
// //         bankTxnNo: getepayTxnId || payment.bankTxnNo || null,
// //       };

// //       console.log(`\n📝 [CALLBACK] Updating payment status to SUCCESS...`);
// //       const updatedPayment = await prisma.payment.update({
// //         where: { id: payment.id },
// //         data: updateData,
// //       });

// //       console.log(`✅ [CALLBACK] Payment status updated to SUCCESS`);
// //       console.log(`  ├─ ID: ${updatedPayment.id}`);
// //       console.log(`  ├─ Status: ${updatedPayment.status}`);
// //       console.log(`  └─ Reference: ${updatedPayment.referenceNo}`);

// //       // Update admission status if linked
// //       if (payment.admissionId) {
// //         console.log(`\n📋 [CALLBACK] Updating admission status...`);
// //         await prisma.admission.update({
// //           where: { id: payment.admissionId },
// //           data: { status: "CONFIRMED" },
// //         });
// //         console.log(`✅ [CALLBACK] Admission confirmed`);
// //       }

// //       // Do not block callback ACK on PDF generation/upload.
// //       console.log(
// //         `\n📄 [CALLBACK] Queueing receipt and certificate generation...`,
// //       );
// //       triggerReceiptGenerationAsync(payment.id, "CALLBACK");

// //       // Log successful payment to audit log
// //       try {
// //         await prisma.auditLog.create({
// //           data: {
// //             userId: payment.studentId,
// //             action: "PAYMENT_SUCCESS",
// //             entity: "Payment",
// //             entityId: payment.id,
// //             payload: JSON.stringify({
// //               amount: payment.totalAmount,
// //               getepayTxnId: getepayTxnId,
// //               paymentMode: paymentMode,
// //               txnDate: txnDate,
// //             }),
// //           },
// //         });
// //         console.log(`✅ [CALLBACK] Audit log created`);
// //       } catch (auditError) {
// //         console.warn(
// //           `⚠️  [CALLBACK] Audit log creation warning:`,
// //           auditError.message,
// //         );
// //       }

// //       console.log(
// //         `\n✅ [CALLBACK] ===== ALL OPERATIONS COMPLETED SUCCESSFULLY =====\n`,
// //       );
// //       return res.status(200).json({
// //         status: "success",
// //         message: "Payment processed successfully",
// //         paymentId: payment.id,
// //         getepayTxnId: getepayTxnId,
// //       });
// //     }
// //     // ========== HANDLE FAILURE ==========
// //     else if (txnStatus === GATEWAY_FAILED) {
// //       console.log(`\n❌ [CALLBACK] ===== PAYMENT FAILED =====`);
// //       console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
// //       console.log(`  Failure Message: ${errorMessage || "Unknown error"}`);

// //       console.log(`\n📝 [CALLBACK] Updating payment status to FAILED...`);
// //       const updatedPayment = await prisma.payment.update({
// //         where: { id: payment.id },
// //         data: {
// //           status: "FAILED",
// //           referenceNo: getepayTxnId || payment.referenceNo || null,
// //           bankTxnNo: getepayTxnId || payment.bankTxnNo || null,
// //         },
// //       });

// //       console.log(`✅ [CALLBACK] Payment status updated to FAILED`);

// //       // Log failed payment to audit log
// //       try {
// //         await prisma.auditLog.create({
// //           data: {
// //             userId: payment.studentId,
// //             action: "PAYMENT_FAILED",
// //             entity: "Payment",
// //             entityId: payment.id,
// //             payload: JSON.stringify({
// //               amount: payment.totalAmount,
// //               getepayTxnId: getepayTxnId,
// //               error: errorMessage || "Unknown error",
// //               txnDate: txnDate,
// //             }),
// //           },
// //         });
// //         console.log(`✅ [CALLBACK] Audit log created for failure`);
// //       } catch (auditError) {
// //         console.warn(
// //           `⚠️  [CALLBACK] Audit log creation warning:`,
// //           auditError.message,
// //         );
// //       }

// //       console.log(`\n❌ [CALLBACK] ===== FAILURE PROCESSING COMPLETE =====\n`);
// //       return res.status(200).json({
// //         status: "failed",
// //         message: "Payment failed",
// //         details: {
// //           paymentId: payment.id,
// //           txnStatus: txnStatus,
// //           error: errorMessage,
// //         },
// //       });
// //     }
// //     // ========== UNKNOWN STATUS ==========
// //     else {
// //       console.log(`\n⚠️  [CALLBACK] Unknown transaction status: ${txnStatus}`);
// //       console.log(`\n⚠️  [CALLBACK] Updating payment status to PENDING...`);

// //       await prisma.payment.update({
// //         where: { id: payment.id },
// //         data: {
// //           status: "PENDING",
// //           referenceNo: getepayTxnId || null,
// //         },
// //       });

// //       console.log(`⚠️  [CALLBACK] ===== UNKNOWN STATUS RECORDED =====\n`);
// //       return res.status(200).json({
// //         status: "pending",
// //         message: "Payment status unknown, marked for review",
// //         paymentId: payment.id,
// //         txnStatus: txnStatus,
// //       });
// //     }
// //   } catch (error) {
// //     console.error("\n❌ [CALLBACK] CRITICAL ERROR:", error.message);
// //     console.error("Stack:", error.stack);
// //     console.log("=".repeat(80) + "\n");
// //     next(error);
// //   }
// // };
