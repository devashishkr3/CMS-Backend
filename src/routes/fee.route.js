const router = require('express').Router();

const feeController = require('../controllers/feeStructure.controller');
// const auth = require('../middleware/auth');
// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');


router.use(protect);

router
  .route('/')
  .post(restrictTo('ADMIN'), feeController.createFee)
  .get(feeController.getAllFees);

router
  .route('/:id')
  .get(feeController.getFee)
  .patch(restrictTo('ADMIN'), feeController.updateFee)
  .delete(restrictTo('ADMIN'), feeController.deleteFee);

module.exports = router;
