const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Create Fee Structure
 * ADMIN only
 */
exports.createFee = async (req, res, next) => {
  try {
    const { courseId, semesterId, head, amount } = req.body;

    if (!courseId || !semesterId || !head || !amount) {
      return next(new AppError('All fields are required', 400));
    }

    const fee = await prisma.feeStructure.create({
      data: {
        courseId,
        semesterId,
        head,
        amount
      }
    });

    res.status(201).json({
      status: 'success',
      data: fee
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Fee already exists for this head', 400));
    }
    next(err);
  }
};


/**
 * Get All Fees
 */
exports.getAllFees = async (req, res, next) => {
  try {

    const { courseId, semesterId } = req.query;

    const where = {};

    if (courseId) where.courseId = courseId;
    if (semesterId) where.semesterId = semesterId;

    const fees = await prisma.feeStructure.findMany({
      where,
      include: {
        course: true,
        semester: true
      },
      orderBy: {
        semesterId: 'asc'
      }
    });

    res.json({
      status: 'success',
      results: fees.length,
      data: fees
    });

  } catch (err) {
    next(err);
  }
};


/**
 * Get Single Fee
 */
exports.getFee = async (req, res, next) => {
  try {

    const fee = await prisma.feeStructure.findUnique({
      where: { id: req.params.id },
      include: {
        course: true,
        semester: true
      }
    });

    if (!fee) {
      return next(new AppError('Fee not found', 404));
    }

    res.json({
      status: 'success',
      data: fee
    });

  } catch (err) {
    next(err);
  }
};


/**
 * Update Fee
 */
exports.updateFee = async (req, res, next) => {
  try {

    const { amount } = req.body;

    const fee = await prisma.feeStructure.update({
      where: { id: req.params.id },
      data: { amount }
    });

    res.json({
      status: 'success',
      data: fee
    });

  } catch (err) {
    next(err);
  }
};


/**
 * Delete Fee
 */
exports.deleteFee = async (req, res, next) => {
  try {

    await prisma.feeStructure.delete({
      where: { id: req.params.id }
    });

    res.json({
      status: 'success',
      message: 'Fee deleted'
    });

  } catch (err) {
    next(err);
  }
};
