const express = require("express");
const router = express.Router();

// Import middleware
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const joiValidator = require("../middlewares/joiValidator");

// Import validation schemas
const { createDepartment, updateDepartment } = require("../validation/department.validation");

// Import controllers
const {
  createDepartment: createDepartmentController,
  getAllDepartments,
  getDepartment,
  updateDepartment: updateDepartmentController,
  deleteDepartment
} = require('../controllers/department.controller');

// All routes below this middleware require authentication
router.use(protect);

// Department Management Routes
router.post('/', restrictTo('ADMIN'), joiValidator(createDepartment, "body"), createDepartmentController);
router.get('/', restrictTo('ADMIN', 'HOD'), getAllDepartments);
router.get('/:id', restrictTo('ADMIN', 'HOD'), getDepartment);
router.patch('/:id', restrictTo('ADMIN'), joiValidator(updateDepartment, "body"), updateDepartmentController);
router.delete('/:id', restrictTo('ADMIN'), deleteDepartment);

module.exports = router;