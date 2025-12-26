const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { logAudit } = require('../utils/auditLogger');
const { createDepartment, updateDepartment } = require('../validation/department.validation');

/**
 * Create a new department
 * Access: ADMIN
 */
exports.createDepartment = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createDepartment.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { name, code, description } = value;

    // Check if department with this name already exists
    const existingDepartment = await prisma.department.findFirst({
      where: { name }
    });

    if (existingDepartment) {
      return next(new AppError('Department with this name already exists', 400));
    }

    // Check if department with this code already exists (if code is provided)
    if (code) {
      const existingDepartmentByCode = await prisma.department.findFirst({
        where: { code }
      });

      if (existingDepartmentByCode) {
        return next(new AppError('Department with this code already exists', 400));
      }
    }

    // Create department
    const department = await prisma.department.create({
      data: {
        name,
        code: code || null,
        description: description || null
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_DEPARTMENT',
      entity: 'Department',
      entityId: department.id,
      payload: { name, code, description },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Department created successfully',
      data: {
        department
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all departments
 * Access: ADMIN, HOD
 */
exports.getAllDepartments = async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        courses: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: departments.length,
      data: {
        departments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get department by ID
 * Access: ADMIN, HOD
 */
exports.getDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        courses: {
          select: {
            id: true,
            code: true,
            name: true,
            durationYears: true
          }
        }
      }
    });

    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        department
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update department
 * Access: ADMIN
 */
exports.updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateDepartment.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id }
    });

    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    const { name, code, description } = value;

    // Check if another department with this name already exists
    if (name && name !== department.name) {
      const existingDepartment = await prisma.department.findFirst({
        where: { 
          name,
          NOT: { id }
        }
      });

      if (existingDepartment) {
        return next(new AppError('Department with this name already exists', 400));
      }
    }

    // Check if another department with this code already exists (if code is provided)
    if (code && code !== department.code) {
      const existingDepartmentByCode = await prisma.department.findFirst({
        where: { 
          code,
          NOT: { id }
        }
      });

      if (existingDepartmentByCode) {
        return next(new AppError('Department with this code already exists', 400));
      }
    }

    // Update department
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        name: name || department.name,
        code: code !== undefined ? code : department.code,
        description: description !== undefined ? description : department.description
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_DEPARTMENT',
      entity: 'Department',
      entityId: id,
      payload: value,
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Department updated successfully',
      data: {
        department: updatedDepartment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete department
 * Access: ADMIN
 */
exports.deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id }
    });

    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    // Check if department has associated courses
    const coursesCount = await prisma.course.count({
      where: { departmentId: id }
    });

    if (coursesCount > 0) {
      return next(new AppError('Cannot delete department with associated courses', 400));
    }

    // Delete department
    await prisma.department.delete({
      where: { id }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_DEPARTMENT',
      entity: 'Department',
      entityId: id,
      payload: { name: department.name },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Department deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};