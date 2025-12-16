const AppError = require("../utils/error");

module.exports = (schema, property = "body") => {
  return (req, res, next) => {
    if (!req[property]) {
      return next(
        new AppError("Request body is missing", 400)
      );
    }

    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(d => d.message);
      return next(new AppError(messages.join(", "), 400));
    }

    // sanitize data
    req[property] = value;
    next();
  };
};
