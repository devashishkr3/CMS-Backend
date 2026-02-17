const Joi = require("joi");

exports.previewPromotionSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
  sessionId: Joi.string().uuid().required()
});

exports.confirmPromotionSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
  sessionId: Joi.string().uuid().required(),
  academicYear: Joi.string().required() // "2025-26"
});
