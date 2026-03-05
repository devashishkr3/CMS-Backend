const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const Joi = require('joi');
const { logAudit } = require('../utils/auditLogger');
const { createStudent, updateStudent, assignSemester, verifyStudentSchema } = require('../validation/student.validation');

/**
 * Create New students and Add old Students also
 * Access: ADMIN, HOD
 */
exports.createStudent = async (req, res, next) => {
  try {
    const { error, value } = createStudent.validate(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }

    const {
      // STUDENT
      reg_no,
      uan_no,
      class_roll,
      name,
      email,
      phone,
      dob,
      fatherName,
      gender,
      category,
      address,
      photoUrl,

      // RELATIONS
      departmentId,
      courseId,
      sessionId,
      semesterId,

      // ADMISSION
      admissionType,
      academicYear,
      admissionNo,
      confidentialNo,
      meritListType,
      profileNo
    } = value;

    // REQUIRED CHECK (uan_no)
    if (!uan_no) {
      return next(new AppError('uan_no is required', 400));
    }

    // DUPLICATE EMAIL
    const emailExists = await prisma.student.findUnique({ where: { email } });
    if (emailExists) {
      return next(new AppError('Student with this email already exists', 400));
    }

    // DUPLICATE UAN
    const uanExists = await prisma.student.findUnique({ where: { uan_no } });
    if (uanExists) {
      return next(new AppError('Student with this UAN already exists', 400));
    }

    // DEPARTMENT
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });
    if (!department) {
      return next(new AppError('Department not found', 404));
    }

    // COURSE
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.departmentId !== departmentId) {
      return next(new AppError('Invalid course for department', 400));
    }

    // SESSION
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    // COURSE SESSION
    const courseSession = await prisma.courseSession.findUnique({
      where: { courseId_sessionId: { courseId, sessionId } }
    });
    if (!courseSession) {
      return next(new AppError('Course not available in selected session', 400));
    }

    // SEMESTER
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester || semester.courseId !== courseId) {
      return next(new AppError('Invalid semester for selected course', 400));
    }

    // AUTO CLASS ROLL (IF NOT PROVIDED)
    const finalClassRoll =
      class_roll || `${course.code}-${semester.number}-${Date.now()}`;

    // TRANSACTION
    const student = await prisma.$transaction(async (tx) => {

      const student = await tx.student.create({
        data: {
          reg_no,
          uan_no,
          class_roll: finalClassRoll,
          name,
          email,
          phone,
          dob: dob ? new Date(dob) : undefined,
          fatherName,
          gender,
          category,
          address,
          photoUrl,
          courseId,
          sessionId,
          status: 'ACTIVE'
        }
      });

      await tx.studentSemester.create({
        data: {
          studentId: student.id,
          semesterId,
          status: 'ONGOING',
          feePaid: false,
          startDate: new Date()
        }
      });

      const admission = await tx.admission.create({
        data: {
          studentId: student.id,
          courseId,
          departmentId,
          sessionId,
          semesterId,
          type: admissionType,
          academicYear,

          // OPTIONAL FIELDS
          admissionNo,
          confidentialNo,
          meritListType,
          profileNo,

          status: 'CONFIRMED'
        }
      });

      await tx.admissionHistory.create({
        data: {
          admissionId: admission.id,
          fromStatus: 'INITIATED',
          toStatus: 'CONFIRMED',
          changedById: req.user.id
        }
      });

      await logAudit({
        userId: req.user.id,
        action: 'CREATE_STUDENT_WITH_ADMISSION',
        entity: 'Student',
        entityId: student.id,
        payload: {
          reg_no,
          uan_no,
          class_roll: finalClassRoll,
          courseId,
          departmentId,
          semesterId,
          admissionType,
          academicYear
        },
        req
      });

      return student;
    });

    res.status(201).json({
      status: 'success',
      message: 'Student admitted successfully',
      data: student
    });

  } catch (err) {
    next(err);
  }
};


// exports.createStudent = async (req, res, next) => {
//   try {
//     const { error, value } = createStudent.validate(req.body);
//     if (error) {
//       return next(new AppError(error.details[0].message, 400));
//     }

//     const {
//       name,
//       email,
//       phone,
//       dob,
//       fatherName,
//       gender,
//       category,
//       address,
//       photoUrl,
//       departmentId,
//       courseId,
//       sessionId,
//       semesterId,
//       admissionType,
//       academicYear
//     } = value;

//     // DUPLICATE EMAIL
//     const emailExists = await prisma.student.findUnique({ where: { email } });
//     if (emailExists) {
//       return next(new AppError('Student with this email already exists', 400));
//     }

//     // DEPARTMENT
//     const department = await prisma.department.findUnique({
//       where: { id: departmentId }
//     });
//     if (!department) {
//       return next(new AppError('Department not found', 404));
//     }

//     // COURSE
//     const course = await prisma.course.findUnique({
//       where: { id: courseId }
//     });
//     if (!course || course.departmentId !== departmentId) {
//       return next(new AppError('Invalid course for department', 400));
//     }

//     // SESSION
//     const session = await prisma.session.findUnique({
//       where: { id: sessionId }
//     });
//     if (!session) {
//       return next(new AppError('Session not found', 404));
//     }

//     // COURSE SESSION
//     const courseSession = await prisma.courseSession.findUnique({
//       where: {
//         courseId_sessionId: { courseId, sessionId }
//       }
//     });
//     if (!courseSession) {
//       return next(new AppError('Course not available in selected session', 400));
//     }

//     // SEMESTER
//     const semester = await prisma.semester.findUnique({
//       where: { id: semesterId }
//     });
//     if (!semester || semester.courseId !== courseId) {
//       return next(new AppError('Invalid semester for selected course', 400));
//     }

//     // REG & UAN
//     const reg_no = `REG${Date.now()}`;
//     const uan_no = `UAN${Date.now()}`;

//     // TRANSACTION
//     const result = await prisma.$transaction(async (tx) => {

//       // STUDENT
//       const student = await tx.student.create({
//         data: {
//           reg_no,
//           uan_no,
//           name,
//           email,
//           phone,
//           dob: dob ? new Date(dob) : undefined,
//           fatherName,
//           gender,
//           category,
//           address,
//           photoUrl,
//           courseId,
//           sessionId,
//           status: 'ACTIVE'
//         }
//       });

//       // STUDENT SEMESTER
//       await tx.studentSemester.create({
//         data: {
//           studentId: student.id,
//           semesterId,
//           status: 'ONGOING',
//           feePaid: false,
//           startDate: new Date()
//         }
//       });

//       // ADMISSION
//       const admission = await tx.admission.create({
//         data: {
//           studentId: student.id,
//           courseId,
//           departmentId,
//           sessionId,
//           semesterId,
//           type: admissionType,
//           academicYear,
//           status: 'CONFIRMED'
//         }
//       });

//       // ADMISSION HISTORY
//       await tx.admissionHistory.create({
//         data: {
//           admissionId: admission.id,
//           fromStatus: 'INITIATED',
//           toStatus: 'CONFIRMED',
//           changedById: req.user.id
//         }
//       });

//       // AUDIT LOG
//       await logAudit({
//         userId: req.user.id,
//         action: 'CREATE_STUDENT_WITH_ADMISSION',
//         entity: 'Student',
//         entityId: student.id,
//         payload: {
//           courseId,
//           departmentId,
//           sessionId,
//           semesterId,
//           admissionType,
//           academicYear
//         },
//         req
//       });

//       return student;
//     });

//     res.status(201).json({
//       status: 'success',
//       message: 'Student admitted successfully',
//       data: result
//     });

//   } catch (err) {
//     next(err);
//   }
// };

/**
 * Get all students with filtering + pagination
 * Access: ADMIN, HOD
 */

exports.getAllStudents = async (req, res, next) => {
  try {
    const {
      status,
      courseId,
      sessionId,
      search,
      page = 1,
      limit = 10
    } = req.query;

    // Convert to number
    const pageNumber = Math.max(Number(page), 1);
    const pageSize = Math.min(Number(limit), 100);
    const skip = (pageNumber - 1) * pageSize;

    // Build where clause
    const where = { isDeleted: false };

    if (status) {
      where.status = status;
    }

    if (courseId) {
      where.courseId = courseId;
    }

    if (sessionId) {
      where.sessionId = sessionId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { reg_no: { contains: search, mode: "insensitive" } }
      ];
    }

    // Count total records
    const totalRecords = await prisma.student.count({ where });

    // Fetch paginated students
    const students = await prisma.student.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const totalPages = Math.ceil(totalRecords / pageSize);

    res.status(200).json({
      status: "success",
      results: students.length,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        totalRecords,
        totalPages,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      },
      data: {
        students
      }
    });
  } catch (error) {
    next(error);
  }
};

// /**
//  * Get all students with filtering + pagination
//  * Access: ADMIN, HOD
//  */
// exports.getAllStudents = async (req, res, next) => {
//   try {
//     const {
//       status,
//       courseId,
//       sessionId,
//       departmentId,
//       semesterId,
//       search,
//       page = 1,
//       limit = 10
//     } = req.query;

//     // Convert to number
//     const pageNumber = Math.max(Number(page), 1);
//     const pageSize = Math.min(Number(limit), 100);
//     const skip = (pageNumber - 1) * pageSize;

//     // Build where clause
//     const where = { isDeleted: false };

//     if (status) {
//       where.status = status;
//     }

//     if (courseId) {
//       where.courseId = courseId;
//     }

//     if (sessionId) {
//       where.sessionId = sessionId;
//     }

//     // NEW FILTERS
//     if (departmentId) {
//       where.departmentId = departmentId;
//     }

//     if (semesterId) {
//       where.semesterId = semesterId;
//     }

//     if (search) {
//       where.OR = [
//         { name: { contains: search, mode: "insensitive" } },
//         { email: { contains: search, mode: "insensitive" } },
//         { reg_no: { contains: search, mode: "insensitive" } }
//       ];
//     }

//     // Count total records
//     const totalRecords = await prisma.student.count({ where });

//     // Fetch paginated students
//     const students = await prisma.student.findMany({
//       where,
//       skip,
//       take: pageSize,
//       include: {
//         department: {
//           select: {
//             id: true,
//             code: true,
//             name: true
//           }
//         },
//         course: {
//           select: {
//             id: true,
//             code: true,
//             name: true
//           }
//         },
//         semester: {
//           select: {
//             id: true,
//             name: true,
//             number: true
//           }
//         },
//         session: {
//           select: {
//             id: true,
//             name: true,
//             startYear: true,
//             endYear: true
//           }
//         }
//       },
//       orderBy: {
//         createdAt: "desc"
//       }
//     });

//     const totalPages = Math.ceil(totalRecords / pageSize);

//     res.status(200).json({
//       status: "success",
//       results: students.length,
//       pagination: {
//         page: pageNumber,
//         limit: pageSize,
//         totalRecords,
//         totalPages,
//         hasNextPage: pageNumber < totalPages,
//         hasPrevPage: pageNumber > 1
//       },
//       data: {
//         students
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

/**
 * Get student by ID
 * Access: ADMIN, HOD, STUDENT (own record)
 */
exports.getStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // For STUDENT role, only allow access to own record
    if (req.user.role === 'STUDENT' && req.user.id !== id) {
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    const student = await prisma.student.findUnique({
      where: { 
        id,
        isDeleted: false
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            durationYears: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true
          }
        },
        semesters: {
          include: {
            semester: {
              select: {
                id: true,
                number: true
              }
            }
          },
          orderBy: {
            startDate: 'asc'
          }
        },
        payments: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            receiptNo: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        certificates: {
          select: {
            id: true,
            type: true,
            status: true,
            issuedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        documents: {
          select: {
            id: true,
            type: true,
            verified: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        admissions: {
          select: {
            id: true,
            status: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        student
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update student
 * Access: ADMIN, HOD
 */
exports.updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = updateStudent.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Update student
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        ...value,
        dob: value.dob ? new Date(value.dob) : undefined,
        uan_no: undefined // Prevent updating UAN as it's unique and should not change
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startYear: true,
            endYear: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_STUDENT',
      entity: 'Student',
      entityId: id,
      payload: value,
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Student updated successfully',
      data: {
        student: updatedStudent
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete student (soft delete)
 * Access: ADMIN
 */
exports.deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Mark student as deleted (soft delete approach)
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        isDeleted: true
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_STUDENT',
      entity: 'Student',
      entityId: id,
      payload: { status: 'DROPOUT' },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Student deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear payment status for all students (test utility)
 * Access: ADMIN, HOD
 */
exports.clearAllStudentPaymentStatuses = async (req, res, next) => {
  try {
    const result = await prisma.payment.updateMany({
      data: {
        status: 'PENDING'
      }
    });

    await logAudit({
      userId: req.user.id,
      action: 'CLEAR_ALL_PAYMENT_STATUSES',
      entity: 'Payment',
      entityId: 'bulk',
      payload: { updatedCount: result.count, newStatus: 'PENDING' },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Payment status cleared for all students',
      data: {
        updatedCount: result.count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign semester to student
 * Access: ADMIN, HOD
 */
exports.assignSemester = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = assignSemester.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { semesterId, startDate, endDate } = value;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id }
    });

    if (!student) {
      return next(new AppError('Student not found', 404));
    }

    // Check if semester exists
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });

    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }

    // Check if semester belongs to student's course
    if (semester.courseId !== student.courseId) {
      return next(new AppError('Semester does not belong to student\'s course', 400));
    }

    // Check if student is already assigned to this semester
    const existingAssignment = await prisma.studentSemester.findFirst({
      where: {
        studentId: id,
        semesterId
      }
    });

    if (existingAssignment) {
      return next(new AppError('Student is already assigned to this semester', 400));
    }
    
    // Check if student already has an ongoing semester (only one active semester allowed)
    const ongoingSemester = await prisma.studentSemester.findFirst({
      where: {
        studentId: id,
        status: 'ONGOING'
      }
    });
    
    if (ongoingSemester && startDate <= ongoingSemester.startDate) {
      return next(new AppError('Student already has an ongoing semester. Cannot assign earlier semester.', 400));
    }

    // Create student semester assignment
    const studentSemester = await prisma.studentSemester.create({
      data: {
        studentId: id,
        semesterId,
        status: 'ONGOING',
        feePaid: false,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined
      },
      include: {
        semester: {
          select: {
            id: true,
            number: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'ASSIGN_SEMESTER_TO_STUDENT',
      entity: 'StudentSemester',
      entityId: studentSemester.id,
      payload: { studentId: id, semesterId, startDate, endDate },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Semester assigned to student successfully',
      data: {
        studentSemester
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update student semester status
 * Access: ADMIN, HOD
 */
exports.updateStudentSemesterStatus = async (req, res, next) => {
  try {
    const { studentId, semesterId } = req.params;
    const { status, feePaid } = req.body;

    // Validate status
    const validStatuses = ['ONGOING', 'COMPLETED', 'FAILED', 'PROMOTED'];
    if (status && !validStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
    }

    // Check if student semester assignment exists
    const studentSemester = await prisma.studentSemester.findUnique({
      where: {
        studentId_semesterId: {
          studentId,
          semesterId
        }
      }
    });

    if (!studentSemester) {
      return next(new AppError('Student semester assignment not found', 404));
    }

    // Update student semester
    const updatedStudentSemester = await prisma.studentSemester.update({
      where: {
        studentId_semesterId: {
          studentId,
          semesterId
        }
      },
      data: {
        status: status || studentSemester.status,
        feePaid: feePaid !== undefined ? feePaid : studentSemester.feePaid
      },
      include: {
        semester: {
          select: {
            id: true,
            number: true
          }
        },
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        }
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_STUDENT_SEMESTER_STATUS',
      entity: 'StudentSemester',
      entityId: studentSemester.id,
      payload: { status, feePaid },
      req
    });
    
    // Find the current semester to get the course
    const currentSemester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });
    
    // If status is COMPLETED, auto-promote student to next semester
    if (status === 'COMPLETED') {
      
      if (currentSemester) {
        // Find the next semester in the same course
        const nextSemester = await prisma.semester.findFirst({
          where: {
            courseId: currentSemester.courseId,
            number: currentSemester.number + 1
          },
          orderBy: {
            number: 'asc'
          }
        });
        
        if (nextSemester) {
          // Check if student is already assigned to the next semester
          const existingNextSemesterAssignment = await prisma.studentSemester.findUnique({
            where: {
              studentId_semesterId: {
                studentId,
                semesterId: nextSemester.id
              }
            }
          });
          
          if (!existingNextSemesterAssignment) {
            // Auto-assign student to the next semester
            await prisma.studentSemester.create({
              data: {
                studentId,
                semesterId: nextSemester.id,
                status: 'ONGOING',
                feePaid: false,
                startDate: new Date(),
                endDate: null // Will be set when semester completes
              }
            });
            
            // Log audit entry for promotion
            await logAudit({
              userId: req.user.id,
              action: 'SEMESTER_AUTO_PROMOTION',
              entity: 'StudentSemester',
              entityId: studentId,
              payload: { 
                studentId, 
                semesterId: nextSemester.id,
                reason: `Auto-promoted from semester ${currentSemester.number} to ${currentSemester.number + 1}`
              },
              req
            });
          }
        } else {
          // If no next semester exists, student has completed the course
          // Update student status to PASSED_OUT
          await prisma.student.update({
            where: { id: studentId },
            data: { status: 'PASSED_OUT' }
          });
          
          // Log audit entry for course completion
          await logAudit({
            userId: req.user.id,
            action: 'STUDENT_COURSE_COMPLETION',
            entity: 'Student',
            entityId: studentId,
            payload: { 
              studentId, 
              reason: `Student completed all semesters for course ${currentSemester.courseId}`
            },
            req
          });
        }
      }
    } else if (status === 'FAILED') {
      // If status is FAILED, ensure no auto-promotion happens
      // Student needs to repeat the semester or be detained
      // No automatic next semester assignment
      
      // Log audit entry for failure
      await logAudit({
        userId: req.user.id,
        action: 'SEMESTER_FAILED',
        entity: 'StudentSemester',
        entityId: studentSemester.id,
        payload: { 
          studentId, 
          semesterId,
          reason: `Student failed semester ${currentSemester ? currentSemester.number : 'unknown'}`
        },
        req
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Student semester status updated successfully',
      data: {
        studentSemester: updatedStudentSemester
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Student For Online Admission / Payment
 * Public API
 */
exports.verifyStudentForAdmission = async (req, res, next) => {
  try {

    /* ============================
       1. VALIDATE
    ============================ */

    const { error, value } = verifyStudentSchema.validate(req.body);

    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }

    const { uan_no, reg_no, phone } = value;


    /* ============================
       2. FIND STUDENT
    ============================ */

    let student;

    if (uan_no) {
      student = await prisma.student.findUnique({
        where: { uan_no }
      });
    }

    if (reg_no) {
      student = await prisma.student.findUnique({
        where: { reg_no }
      });
    }

    if (!student) {
      return next(new AppError("Student not found", 404));
    }


    /* ============================
       3. VERIFY MOBILE
    ============================ */

    if (student.phone !== phone) {
      return next(new AppError("Mobile number does not match", 401));
    }


    /* ============================
       4. FETCH FULL PROFILE
    ============================ */

    const profile = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        session: {
          select: {
            id: true,
            name: true
          }
        },
        semesters: {
          include: {
            semester: {
              select: {
                number: true
              }
            }
          },
          orderBy: {
            startDate: "desc"
          }
        },
        admissions: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });


    /* ============================
       5. RESPONSE
    ============================ */

    res.status(200).json({
      status: "success",
      message: "Student verified successfully",
      data: {
        studentId: profile.id,
        name: profile.name,
        reg_no: profile.reg_no,
        uan_no: profile.uan_no,
        phone: profile.phone,

        course: profile.course,
        session: profile.session,

        currentSemester:
          profile.semesters[0]?.semester?.number || null,

        lastAdmission:
          profile.admissions[0] || null
      }
    });

  } catch (err) {
    next(err);
  }
};


// exports.bulkCreateStudents = async (req, res, next) => {
//   try {
//     const students = req.body.students; // array

//     const BATCH_SIZE = 100;

//     for (let i = 0; i < students.length; i += BATCH_SIZE) {
//       const batch = students.slice(i, i + BATCH_SIZE);

//       await prisma.$transaction(
//         batch.map(s =>
//           prisma.student.create({
//             data: {
//               ...s,
//               reg_no: `REG${Date.now()}${Math.random()}`,
//               uan_no: `UAN${Date.now()}${Math.random()}`
//             }
//           })
//         )
//       );
//     }

//     res.json({ status: 'success', message: 'Bulk import completed' });

//   } catch (e) {
//     next(e);
//   }
// };
