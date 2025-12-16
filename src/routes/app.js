const express = require("express");
const router = express.Router();
const adminRoute = require("../routes/admin.route.js");
const authRoute = require("../routes/auth.routes.js");

router.use("/auth", authRoute);
router.use("/admin", adminRoute);

module.exports = router;