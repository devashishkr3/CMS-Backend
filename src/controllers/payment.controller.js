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

const GATEWAY_SUCCESS = "SUCCESS";
const GATEWAY_FAILED = "FAILED";

const normalizeTxnStatus = (status) => {
  if (!status) return "";
  return String(status).trim().toUpperCase();
};

const getEncryptedGatewayResponse = (req) => {
  return (
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
    txnStatus: normalizeTxnStatus(decrypted.txnStatus || decrypted.status),
    getepayTxnId:
      decrypted.getepayTxnId ||
      decrypted.bankTxnNo ||
      decrypted.referenceNo ||
      null,
    paymentMode: decrypted.paymentMode || null,
    txnDate: decrypted.txnDate || null,
    txnAmount: decrypted.txnAmount || null,
    errorMessage: decrypted.message || decrypted.errorMessage || null
  };
};

const buildProcessingRedirectUrl = (paymentId, extraQuery = {}) => {
  const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
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
      console.warn('⚠️  Database unavailable, using mock data for testing');
      
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

    console.log(`✅ Payment found: ${payment.receiptNo}, Amount: ${payment.totalAmount}`);

    // Build GetEpay payload
    const payload = {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      amount: payment.totalAmount.toString(),
      merchantTransactionId: payment.txnId,
      transactionDate: new Date().toISOString(),
      ru: `${process.env.GETEPAY_RETURN_URL}?paymentId=${payment.id}`,
      callbackUrl: `${process.env.GETEPAY_CALLBACK_URL}?paymentId=${payment.id}`,
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

    console.log(`📦 Payload created, amount: ${payload.amount}`);

    // Initialize encryption
    console.log(`🔑 IV: ${process.env.GETEPAY_IV ? 'Set' : 'NULL'}`);
    console.log(`🔑 KEY: ${process.env.GETEPAY_KEY ? 'Set' : 'NULL'}`);

    const enc = new GcmPgEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY
    );

    console.log(`🔐 Encrypting payload...`);
    const encrypted = await enc.encrypt(JSON.stringify(payload));
    console.log(`✅ Encrypted successfully, length: ${encrypted.length}`);

    // Call GetEpay API
    console.log(`🚀 Calling GetEpay API at: ${process.env.GETEPAY_URL}`);
    console.log(`📤 Request data:`, {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      req: encrypted.substring(0, 50) + '...' // Show first 50 chars
    });

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

    console.log(`✅ GetEpay API response status: ${response.status}`);
    console.log(`📥 Full Response object keys:`, Object.keys(response.data));
    console.log(`📥 Complete Response data:`, JSON.stringify(response.data, null, 2));

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

    console.log(`🔍 Checking for response field...`);
    console.log(`   response.data.response exists?`, !!response.data.response);
    console.log(`   response.data.resp exists?`, !!response.data.resp);
    console.log(`   response.data.paymentUrl exists?`, !!response.data.paymentUrl);
    console.log(`   All data keys:`, Object.keys(response.data));

    if (!response.data.response) {
      console.error('❌ GetEpay response.data.response is missing');
      console.error('Available fields:', Object.keys(response.data));
      throw new AppError('GetEpay response format invalid - no encrypted response data', 502);
    }

    // Decrypt response
    console.log(`🔓 Decrypting response...`);
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
    console.log(`✅ Decrypted response:`, decrypted);

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

    console.log(`✅ Payment link generated successfully`);

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
    const payload = {
      mid: process.env.GETEPAY_MID,
      terminalId: process.env.GETEPAY_TERMINAL_ID,
      amount: payment.totalAmount.toString(),
      merchantTransactionId: payment.txnId,
      transactionDate: new Date().toISOString(),
      ru: `${process.env.GETEPAY_RETURN_URL}?paymentId=${payment.id}`,
      callbackUrl: `${process.env.GETEPAY_CALLBACK_URL}?paymentId=${payment.id}`,
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
 */
exports.paymentReturn = async (req, res, next) => {
  try {
    let paymentId = req.query.paymentId;
    let txnStatus = normalizeTxnStatus(req.query.txnStatus || req.query.status);
    let getepayTxnId = null;
    let merchantTxnId = null;

    const encryptedResponse = getEncryptedGatewayResponse(req);

    if ((!paymentId || !txnStatus) && encryptedResponse) {
      try {
        const enc = new GcmPgEncryption(
          process.env.GETEPAY_IV,
          process.env.GETEPAY_KEY
        );
        const decryptedData = await enc.decrypt(encryptedResponse);
        const decrypted = JSON.parse(decryptedData);
        const parsed = parseGatewayResponseFields(decrypted);

        txnStatus = txnStatus || parsed.txnStatus;
        getepayTxnId = parsed.getepayTxnId;
        merchantTxnId = parsed.merchantTxnId;

        if (!paymentId && parsed.merchantTxnId) {
          const payment = await prisma.payment.findUnique({
            where: { txnId: parsed.merchantTxnId },
            select: { id: true }
          });

          if (payment) {
            paymentId = payment.id;
          }
        }
      } catch (error) {
        console.warn("⚠️  [RETURN] Unable to decrypt return payload:", error.message);
      }
    }

    // Fallback update: if return URL includes status, persist it immediately.
    // Callback remains primary, but this keeps status in sync when callback is delayed/unavailable.
    if (paymentId && (txnStatus === GATEWAY_SUCCESS || txnStatus === GATEWAY_FAILED)) {
      try {
        const payment = await prisma.payment.findUnique({
          where: { id: paymentId },
          select: { id: true, status: true, admissionId: true }
        });

        if (payment) {
          const nextStatus = txnStatus === GATEWAY_SUCCESS ? "SUCCESS" : "FAILED";

          if (payment.status !== nextStatus) {
            await prisma.payment.update({
              where: { id: paymentId },
              data: {
                status: nextStatus,
                referenceNo: getepayTxnId || undefined,
                bankTxnNo: getepayTxnId || undefined
              }
            });

            if (nextStatus === "SUCCESS" && payment.admissionId) {
              await prisma.admission.update({
                where: { id: payment.admissionId },
                data: { status: "CONFIRMED" }
              });
            }
          }
        } else if (merchantTxnId) {
          // Optional fallback by merchant transaction id if paymentId was invalid/stale
          await prisma.payment.update({
            where: { txnId: merchantTxnId },
            data: {
              status: txnStatus === GATEWAY_SUCCESS ? "SUCCESS" : "FAILED",
              referenceNo: getepayTxnId || undefined,
              bankTxnNo: getepayTxnId || undefined
            }
          });
        }
      } catch (returnUpdateError) {
        console.warn("⚠️  [RETURN] Failed to update payment status from return payload:", returnUpdateError.message);
      }
    }

    if (!paymentId) {
      return res.redirect(buildProcessingRedirectUrl(null, { error: "missing_payment_id" }));
    }

    const redirectUrl = buildProcessingRedirectUrl(paymentId, {
      gatewayStatus: txnStatus || undefined
    });

    console.log(`✅ [RETURN] Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error(`❌ [RETURN] Error:`, error.message);
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
    console.log('\n' + '='.repeat(80));
    console.log('🔔 [CALLBACK] ===== GETEPAY CALLBACK RECEIVED =====');
    console.log('='.repeat(80));
    
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

    console.log('📦 [CALLBACK] Received encrypted response (first 100 chars):', 
      encryptedResponse.substring(0, 100) + '...');

    // Initialize decryption with GetEpay credentials
    const enc = new GcmPgEncryption(
      process.env.GETEPAY_IV,
      process.env.GETEPAY_KEY
    );

    // Decrypt response from GetEpay
    console.log('🔐 [CALLBACK] Decrypting response with AES-256-GCM...');
    let decryptedData;
    try {
      decryptedData = await enc.decrypt(encryptedResponse);
      console.log('✅ [CALLBACK] Decryption successful');
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
      console.log('✅ [CALLBACK] JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ [CALLBACK] JSON parse failed:', parseError.message);
      console.error('📦 [CALLBACK] Decrypted content:', decryptedData);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Invalid JSON response' 
      });
    }

    console.log('📋 [CALLBACK] Decrypted Response Data:');
    console.log(JSON.stringify(decrypted, null, 2));

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

    console.log('🔍 [CALLBACK] Extracted Fields:');
    console.log(`  ├─ Merchant Txn ID: ${merchantTxnId}`);
    console.log(`  ├─ Status: ${txnStatus}`);
    console.log(`  ├─ GetEpay Txn ID: ${getepayTxnId}`);
    console.log(`  ├─ Amount: ${txnAmount}`);
    console.log(`  ├─ Mode: ${paymentMode}`);
    console.log(`  └─ Date: ${txnDate}`);

    // Validate transaction ID exists
    if (!merchantTxnId) {
      console.error('❌ [CALLBACK] Missing merchantOrderNo in response');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing merchantOrderNo in response' 
      });
    }

    // Find payment by our transaction ID
    console.log(`\n🔍 [CALLBACK] Finding payment with txnId: ${merchantTxnId}`);
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

    console.log(`✅ [CALLBACK] Payment found: ${payment.id}`);
    console.log(`  ├─ Student: ${payment.student?.name}`);
    console.log(`  ├─ Amount: ₹${payment.totalAmount}`);
    console.log(`  └─ Current Status: ${payment.status}`);

    // ========== HANDLE SUCCESS ==========
    if (txnStatus === GATEWAY_SUCCESS) {
      console.log(`\n💰 [CALLBACK] ===== PAYMENT SUCCESSFUL =====`);
      console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
      console.log(`  Payment Mode: ${paymentMode}`);

      // Update payment with success details
      const updateData = {
        status: "SUCCESS",
        referenceNo: getepayTxnId || payment.referenceNo || null,
        bankTxnNo: getepayTxnId || payment.bankTxnNo || null
      };

      console.log(`\n📝 [CALLBACK] Updating payment status to SUCCESS...`);
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: updateData
      });
      
      console.log(`✅ [CALLBACK] Payment status updated to SUCCESS`);
      console.log(`  ├─ ID: ${updatedPayment.id}`);
      console.log(`  ├─ Status: ${updatedPayment.status}`);
      console.log(`  └─ Reference: ${updatedPayment.referenceNo}`);

      // Update admission status if linked
      if (payment.admissionId) {
        console.log(`\n📋 [CALLBACK] Updating admission status...`);
        await prisma.admission.update({
          where: { id: payment.admissionId },
          data: { status: 'CONFIRMED' }
        });
        console.log(`✅ [CALLBACK] Admission confirmed`);
      }

      // Generate receipt and certificate
      try {
        console.log(`\n📄 [CALLBACK] Generating receipt and certificate...`);
        await generateReceiptAndCertificate(payment.id);
        console.log(`✅ [CALLBACK] Receipt generated`);
      } catch (err) {
        console.warn(`⚠️  [CALLBACK] Receipt generation warning:`, err.message);
        // Don't fail the callback if receipt generation fails
      }

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
        console.log(`✅ [CALLBACK] Audit log created`);
      } catch (auditError) {
        console.warn(`⚠️  [CALLBACK] Audit log creation warning:`, auditError.message);
      }

      console.log(`\n✅ [CALLBACK] ===== ALL OPERATIONS COMPLETED SUCCESSFULLY =====\n`);
      return res.status(200).json({ 
        status: 'success', 
        message: 'Payment processed successfully',
        paymentId: payment.id,
        getepayTxnId: getepayTxnId
      });

    } 
    // ========== HANDLE FAILURE ==========
    else if (txnStatus === GATEWAY_FAILED) {
      console.log(`\n❌ [CALLBACK] ===== PAYMENT FAILED =====`);
      console.log(`  GetEpay Txn ID: ${getepayTxnId}`);
      console.log(`  Failure Message: ${errorMessage || 'Unknown error'}`);

      console.log(`\n📝 [CALLBACK] Updating payment status to FAILED...`);
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          referenceNo: getepayTxnId || payment.referenceNo || null,
          bankTxnNo: getepayTxnId || payment.bankTxnNo || null
        }
      });

      console.log(`✅ [CALLBACK] Payment status updated to FAILED`);

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
        console.log(`✅ [CALLBACK] Audit log created for failure`);
      } catch (auditError) {
        console.warn(`⚠️  [CALLBACK] Audit log creation warning:`, auditError.message);
      }

      console.log(`\n❌ [CALLBACK] ===== FAILURE PROCESSING COMPLETE =====\n`);
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
      console.log(`\n⚠️  [CALLBACK] Unknown transaction status: ${txnStatus}`);
      console.log(`\n⚠️  [CALLBACK] Updating payment status to PENDING...`);
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDING",
          referenceNo: getepayTxnId || null
        }
      });

      console.log(`⚠️  [CALLBACK] ===== UNKNOWN STATUS RECORDED =====\n`);
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
    console.log('='.repeat(80) + '\n');
    next(error);
  }
};
