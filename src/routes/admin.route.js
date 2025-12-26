const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { createUser: createUserValidation, updateUserStatus: updateUserStatusValidation } = require("../validation/admin.validation");

// Import controllers
const {
  createUser,
  getAllUsers,
  updateUserStatus
} = require('../controllers/admin.controller');

// All routes below this middleware require authentication
router.use(protect, restrictTo('ADMIN'));

// User Management Routes
router.post('/users', joiValidator(createUserValidation, "body"), createUser);
router.get('/users', getAllUsers);
router.patch('/users/:id/status', joiValidator(updateUserStatusValidation, "body"), updateUserStatus);

module.exports = router;