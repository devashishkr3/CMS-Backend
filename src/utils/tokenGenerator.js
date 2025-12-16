const jwt = require('jsonwebtoken');

exports.generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
};

exports.generateRefreshToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

// exports.verifyAccessToken = (token) => {
//   try {
//     return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
//   } catch (err) {
//     throw new AppError(err.message, 401);
//   }
// };

// exports.verifyRefreshToken = async (token) => {
//   const blacklisted = await prisma.blacklistedToken.findUnique({
//     where: { token },
//   });
//   if (blacklisted)
//     throw new AppError("Refresh token has been blacklisted", 401);

//   try {
//     return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
//   } catch (err) {
//     throw new AppError(err.message, 401);
//   }
// };
