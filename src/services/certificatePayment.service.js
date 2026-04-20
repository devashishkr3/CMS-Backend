const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { CERTIFICATE_FEES } = require('../validation/certificate.validation');
const GcmPgEncryption = require('../utils/getepayEncrypt');
const axios = require('axios');

const getBackendPublicBase = (req) => {
  const configured = String(process.env.BACKEND_PUBLIC_URL || '').trim();
  if (configured && (configured.startsWith('http://') || configured.startsWith('https://'))) {
    return configured.replace(/\/+$/, '');
  }

  if (req?.protocol && req?.get) {
    return `${req.protocol}://${req.get('host')}`;
  }

  return 'http://localhost:8080';
};

/**
 * Create payment for certificate application
 * @param {String} certificateId - Certificate request ID
 * @param {Object} req - Express request object
 * @returns {Object} Payment data with gateway URL
 */
exports.createCertificatePayment = async (certificateId, req) => {
  // 1. Fetch certificate
  const certificate = await prisma.certificateRequest.findUnique({
    where: { id: certificateId }
  });

  if (!certificate) {
    throw new AppError('Certificate request not found', 404);
  }

  // 2. Check if already paid successfully
  const existingPayment = await prisma.payment.findUnique({
    where: { certificateId }
  });

  if (existingPayment && existingPayment.status === 'SUCCESS') {
    throw new AppError('Payment already completed for this certificate', 400);
  }

  // 3. Determine amount based on certificate type
  const amount = CERTIFICATE_FEES[certificate.type];
  if (!amount) {
    throw new AppError('Invalid certificate type', 400);
  }

  // 4. If payment exists but not successful, reuse it
  if (existingPayment && existingPayment.status !== 'SUCCESS') {
    const paymentUrl = await generatePaymentLink(existingPayment, certificate, req);
    
    return {
      paymentId: existingPayment.id,
      paymentUrl,
      amount,
      certificateType: certificate.type,
      receiptNo: existingPayment.receiptNo
    };
  }

  // 5. Generate unique transaction ID and receipt number
  const txnId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const receiptNo = `CERT-RCT-${Date.now()}`;

  // 6. Create new payment record
  const payment = await prisma.payment.create({
    data: {
      certificateId,
      totalAmount: amount,
      status: 'INITIATED',
      gateway: 'GETEPAY',
      txnId,
      receiptNo
    }
  });

  // 7. Generate GetEpay payment link
  const paymentUrl = await generatePaymentLink(payment, certificate, req);

  return {
    paymentId: payment.id,
    paymentUrl,
    amount,
    certificateType: certificate.type,
    receiptNo: payment.receiptNo
  };
};

/**
 * Generate payment link via GetEpay gateway
 * @param {Object} payment - Payment record
 * @param {Object} certificate - Certificate record
 * @param {Object} req - Express request object
 * @returns {String} Payment URL
 */
async function generatePaymentLink(payment, certificate, req) {
  const baseUrl = getBackendPublicBase(req);
  
  const payload = {
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    amount: payment.totalAmount.toString(),
    merchantTransactionId: payment.txnId,
    transactionDate: new Date().toISOString(),
    ru: `${baseUrl}/api/v1/payments/return`,
    callbackUrl: `${baseUrl}/api/v1/payments/callback`,
    currency: 'INR',
    paymentMode: 'ALL',
    bankId: '455',
    txnType: 'single',
    productType: 'IPG',
    txnNote: `Certificate payment for ${certificate.name || 'Student'} - ${certificate.type}`,
    udf1: '',
    udf2: '',
    udf3: certificate.name || '',
    udf4: '',
    udf5: certificate.id
  };

  // Initialize encryption
  const enc = new GcmPgEncryption(process.env.GETEPAY_IV, process.env.GETEPAY_KEY);
  
  // Encrypt payload
  const encrypted = await enc.encrypt(JSON.stringify(payload));

  // Call GetEpay API
  const response = await axios.post(process.env.GETEPAY_URL, {
    mid: process.env.GETEPAY_MID,
    terminalId: process.env.GETEPAY_TERMINAL_ID,
    req: encrypted
  }, {
    timeout: 30000
  });

  // Check for GetEpay error
  if (response.data.status === 'FAILED') {
    throw new AppError(`GetEpay Error: ${response.data.message}`, 502);
  }

  if (!response.data.response) {
    throw new AppError('GetEpay response format invalid - no encrypted response data', 502);
  }

  // Decrypt response
  const decryptedStr = await enc.decrypt(response.data.response);
  const decrypted = JSON.parse(decryptedStr);

  if (!decrypted.paymentUrl) {
    throw new AppError('GetEpay response missing payment URL', 502);
  }

  return decrypted.paymentUrl;
}
