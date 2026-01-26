const { calculateSemesterFee } = require('../services/fee.service');
const prisma = require('../config/prisma');


exports.getPayableFee = async (req, res, next) => {
  try {

    const { semesterId } = req.query;

    const fee = await calculateSemesterFee(
      req.user.id,
      semesterId
    );

    res.json({
      status: 'success',
      data: fee
    });

  } catch (err) {
    next(err);
  }
};
