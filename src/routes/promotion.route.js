const express = require("express");
const router = express.Router();

const { protect, restrictTo } = require("../middlewares/auth.middleware");
const joiValidator = require("../middlewares/joiValidator");

const {
  previewAutoPromotion,
  confirmAutoPromotion
} = require("../controllers/promotion.controller");

const {
  previewPromotionSchema,
  confirmPromotionSchema
} = require("../validation/promotion.validaton");


router.use(protect);


/* PREVIEW */
router.get(
  "/preview",
  restrictTo("ADMIN", "HOD"),
  joiValidator(previewPromotionSchema, "query"),
  previewAutoPromotion
);


/* CONFIRM */
router.post(
  "/confirm",
  restrictTo("ADMIN"),
  joiValidator(confirmPromotionSchema, "body"),
  confirmAutoPromotion
);

module.exports = router;
