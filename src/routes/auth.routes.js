const express = require("express");
const prisma = require("../config/prisma");
const joiValidator = require("../middlewares/joiValidator");
const { registerUser, loginUser, refreshToken, logoutUser } = require("../validation/auth.validation");
const authController = require("../controllers/auth.controller");
const router = express.Router();


router.post("/register",joiValidator(registerUser, "body"), authController.registerUser);
router.post("/login", joiValidator(loginUser, 'body'), authController.loginUser);
router.post("/logout",
     authController.logoutUser);
router.post("/refresh-token",
     authController.refreshToken);

module.exports = router;