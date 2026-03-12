const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const Joi = require('joi');
const { logAudit } = require('../utils/auditLogger');
const { createStudent, updateStudent, assignSemester, verifyStudentSchema, bulkCreateStudents } = require('../validation/student.validation');
const { parseExcelStudents, validateParsedStudents } = require('../utils/excelParser');

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
      university_roll,
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

    // DUPLICATE EMAIL CHECK (if email provided)
    if (email) {
      const emailExists = await prisma.student.findUnique({ where: { email } });
      if (emailExists) {
        return next(new AppError('Student with this email already exists', 400));
      }
    }

    // DUPLICATE UAN CHECK (if uan provided)
    if (uan_no) {
      const uanExists = await prisma.student.findUnique({ where: { uan_no } });
      if (uanExists) {
        return next(new AppError('Student with this UAN already exists', 400));
      }
    }

    // DUPLICATE UNIVERSITY ROLL CHECK (if university_roll provided)
    if (university_roll) {
      const universityRollExists = await prisma.student.findUnique({ where: { university_roll } });
      if (universityRollExists) {
        return next(new AppError('Student with this University Roll already exists', 400));
      }
    }

    // DEPARTMENT (if departmentId provided)
    let department;
    if (departmentId) {
      department = await prisma.department.findUnique({
        where: { id: departmentId }
      });
      if (!department) {
        return next(new AppError('Department not found', 404));
      }
    }

    // COURSE (if courseId provided)
    let course;
    if (courseId) {
      course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course || (departmentId && course.departmentId !== departmentId)) {
        return next(new AppError('Invalid course for department', 400));
      }
    }

    // SESSION (if sessionId provided)
    let session;
    if (sessionId) {
      session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) {
        return next(new AppError('Session not found', 404));
      }
    }

    // COURSE SESSION (if courseId and sessionId provided)
    if (courseId && sessionId) {
      const courseSession = await prisma.courseSession.findUnique({
        where: { courseId_sessionId: { courseId, sessionId } }
      });
      if (!courseSession) {
        return next(new AppError('Course not available in selected session', 400));
      }
    }

    // SEMESTER (if semesterId provided)
    let semester;
    if (semesterId) {
      semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester || (courseId && semester.courseId !== courseId)) {
        return next(new AppError('Invalid semester for selected course', 400));
      }
    }

    // AUTO CLASS ROLL (IF NOT PROVIDED)
    const finalClassRoll =
      class_roll || (course && semester ? `${course.code}-${semester.number}-${Date.now()}` : undefined);

    // TRANSACTION
    const student = await prisma.$transaction(async (tx) => {

      const student = await tx.student.create({
        data: {
          reg_no,
          uan_no,
          class_roll: finalClassRoll,
          university_roll,
          name,
          email,
          phone,
          dob: dob ? new Date(dob) : undefined,
          fatherName,
          gender,
          category,
          address,
          photoUrl,
          courseId: courseId || null,
          sessionId: sessionId || null,
          status: 'ACTIVE'
        }
      });

      // Create student semester if semesterId provided
      if (semesterId) {
        await tx.studentSemester.create({
          data: {
            studentId: student.id,
            semesterId,
            status: 'ONGOING',
            feePaid: false,
            startDate: new Date()
          }
        });
      }

      // Create admission if required fields are provided
      if (admissionType && academicYear && courseId && sessionId && semesterId) {
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
      }

      await logAudit({
        userId: req.user.id,
        action: 'CREATE_STUDENT_WITH_ADMISSION',
        entity: 'Student',
        entityId: student.id,
        payload: {
          reg_no,
          uan_no,
          class_roll: finalClassRoll,
          university_roll,
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

/**
 * Bulk Create Students (JSON)
 * Access: ADMIN, HOD
 */
exports.bulkCreateStudents = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = bulkCreateStudents.validate(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }

    const {
      students,
      courseId,
      sessionId,
      semesterId,
      departmentId,
      academicYear = '2024-25',
      admissionType = 'NEW'
    } = value;

    // Verify course, session, and semester exist
    const [course, session, semester] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.session.findUnique({ where: { id: sessionId } }),
      prisma.semester.findUnique({ where: { id: semesterId } })
    ]);

    if (!course) {
      return next(new AppError('Course not found', 404));
    }
    if (!session) {
      return next(new AppError('Session not found', 404));
    }
    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }
    if (semester.courseId !== courseId) {
      return next(new AppError('Semester does not belong to the selected course', 400));
    }

    // Check for duplicate university rolls in database
    const existingRolls = await prisma.student.findMany({
      where: {
        university_roll: {
          in: students.map(s => s.university_roll)
        }
      },
      select: { university_roll: true }
    });

    const existingRollSet = new Set(existingRolls.map(r => r.university_roll));
    const duplicates = students.filter(s => existingRollSet.has(s.university_roll));

    if (duplicates.length > 0) {
      return next(new AppError(
        `Duplicate university rolls found: ${duplicates.map(d => d.university_roll).join(', ')}`,
        400
      ));
    }

    // Check for duplicate university rolls within the batch
    const rollCounts = {};
    students.forEach(s => {
      rollCounts[s.university_roll] = (rollCounts[s.university_roll] || 0) + 1;
    });

    const internalDuplicates = Object.entries(rollCounts)
      .filter(([_, count]) => count > 1)
      .map(([roll, _]) => roll);

    if (internalDuplicates.length > 0) {
      return next(new AppError(
        `Duplicate university rolls within batch: ${internalDuplicates.join(', ')}`,
        400
      ));
    }

    // Process students in batches
    const BATCH_SIZE = 50;
    const createdStudents = [];
    const errors = [];

    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const batch = students.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (studentData, index) => {
          try {
            const globalIndex = i + index;

            // Generate reg_no and uan_no if not provided
            const reg_no = studentData.reg_no || `REG${Date.now()}${globalIndex}`;
            const uan_no = studentData.uan_no || `UAN${Date.now()}${globalIndex}`;

            // Create student record
            const student = await prisma.student.create({
              data: {
                reg_no,
                uan_no,
                class_roll: studentData.class_roll || `${course.code}-${semester.number}-${globalIndex + 1}`,
                university_roll: studentData.university_roll,
                name: studentData.name,
                email: studentData.email || null,
                phone: studentData.phone || null,
                dob: studentData.dob ? new Date(studentData.dob) : null,
                fatherName: studentData.fatherName,
                gender: studentData.gender || null,
                category: studentData.category || null,
                address: studentData.address || null,
                courseId,
                sessionId,
                status: 'ACTIVE'
              }
            });

            // Create student semester assignment
            await prisma.studentSemester.create({
              data: {
                studentId: student.id,
                semesterId,
                status: 'ONGOING',
                feePaid: false,
                startDate: new Date()
              }
            });

            // Create admission record
            if (departmentId) {
              const admission = await prisma.admission.create({
                data: {
                  studentId: student.id,
                  courseId,
                  departmentId,
                  sessionId,
                  semesterId,
                  type: admissionType,
                  academicYear,
                  status: 'CONFIRMED'
                }
              });

              // Create admission history
              await prisma.admissionHistory.create({
                data: {
                  admissionId: admission.id,
                  fromStatus: 'INITIATED',
                  toStatus: 'CONFIRMED',
                  changedById: req.user.id
                }
              });
            }

            return { success: true, student };
          } catch (error) {
            return {
              success: false,
              index: globalIndex,
              university_roll: studentData.university_roll,
              error: error.message
            };
          }
        })
      );

      batchResults.forEach(result => {
        if (result.success) {
          createdStudents.push(result.student);
        } else {
          errors.push(result);
        }
      });
    }

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'BULK_CREATE_STUDENTS',
      entity: 'Student',
      entityId: 'bulk',
      payload: {
        totalRecords: students.length,
        successCount: createdStudents.length,
        failureCount: errors.length,
        courseId,
        sessionId,
        semesterId,
        departmentId
      },
      req
    });

    res.status(201).json({
      status: 'success',
      message: `Successfully created ${createdStudents.length} out of ${students.length} students`,
      data: {
        totalRecords: students.length,
        successCount: createdStudents.length,
        failureCount: errors.length,
        students: createdStudents,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (err) {
    console.error('Bulk create error:', err);
    next(err);
  }
};

/**
 * Bulk Upload Students from Excel File
 * Access: ADMIN, HOD
 */
exports.bulkUploadStudentsFromExcel = async (req, res, next) => {
  try {
    // Check if file is provided
    if (!req.file) {
      return next(new AppError('Please upload an Excel file (.xlsx or .xls)', 400));
    }

    // Parse Excel file
    const parseResult = parseExcelStudents(req.file.buffer);

    if (!parseResult.success) {
      return next(new AppError(`Excel parsing failed: ${parseResult.error}`, 400));
    }

    // Validate parsed data
    const validationResult = validateParsedStudents(parseResult.data);

    if (!validationResult.isValid) {
      return next(new AppError(
        `Validation failed for ${validationResult.invalidCount} records`,
        400,
        validationResult.errors
      ));
    }

    // Extract fixed IDs from request body
    const {
      courseId,
      sessionId,
      semesterId,
      departmentId,
      academicYear = '2024-25',
      admissionType = 'NEW'
    } = req.body;

    // Validate required IDs
    if (!courseId || !sessionId || !semesterId) {
      return next(new AppError('courseId, sessionId, and semesterId are required', 400));
    }

    // Prepare students array for bulk creation
    const students = validationResult.validStudents.map(student => ({
      name: student.name,
      fatherName: student.fatherName,
      university_roll: student.university_roll,
      class_roll: student.class_roll,
      majorSubject: student.majorSubject,
      minorSubject: student.minorSubject
    }));

    // Call bulk create logic
    req.body = {
      students,
      courseId,
      sessionId,
      semesterId,
      departmentId,
      academicYear,
      admissionType
    };

    // Reuse bulkCreateStudents logic
    return exports.bulkCreateStudents(req, res, next);

  } catch (err) {
    console.error('Excel upload error:', err);
    next(err);
  }
};

/**
 * Bulk Update Students University Roll
 * Access: ADMIN, HOD
 */
exports.bulkUpdateStudents = async (req, res, next) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return next(new AppError('Students array is required and must not be empty', 400));
    }

    // Validate each student has university_roll
    const invalidStudents = students.filter(
      s => !s.university_roll || !s.id
    );

    if (invalidStudents.length > 0) {
      return next(new AppError(
        'Each student must have id and university_roll fields',
        400
      ));
    }

    // Update students in batches
    const BATCH_SIZE = 50;
    const updatedStudents = [];
    const errors = [];

    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const batch = students.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (studentData, index) => {
          try {
            const updatedStudent = await prisma.student.update({
              where: { id: studentData.id },
              data: {
                university_roll: studentData.university_roll,
                class_roll: studentData.class_roll || undefined,
                name: studentData.name || undefined,
                fatherName: studentData.fatherName || undefined
              }
            });

            return { success: true, student: updatedStudent };
          } catch (error) {
            return {
              success: false,
              id: studentData.id,
              university_roll: studentData.university_roll,
              error: error.message
            };
          }
        })
      );

      batchResults.forEach(result => {
        if (result.success) {
          updatedStudents.push(result.student);
        } else {
          errors.push(result);
        }
      });
    }

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'BULK_UPDATE_STUDENTS',
      entity: 'Student',
      entityId: 'bulk',
      payload: {
        totalRecords: students.length,
        successCount: updatedStudents.length,
        failureCount: errors.length
      },
      req
    });

    res.status(200).json({
      status: 'success',
      message: `Successfully updated ${updatedStudents.length} out of ${students.length} students`,
      data: {
        totalRecords: students.length,
        successCount: updatedStudents.length,
        failureCount: errors.length,
        students: updatedStudents,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (err) {
    next(err);
  }
};

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
        uan_no: undefined, // Prevent updating UAN as it's unique and should not change
        university_roll: value.university_roll || undefined // Allow updating university_roll
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
            reg_no: true,
            university_roll: true
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

    const { uan_no, reg_no, university_roll, phone } = value;


    /* ============================
       2. FIND STUDENT
    ============================ */

    let student;

    if (uan_no) {
      student = await prisma.student.findUnique({
        where: { uan_no }
      });
    } else if (reg_no) {
      student = await prisma.student.findUnique({
        where: { reg_no }
      });
    } else if (university_roll) {
      student = await prisma.student.findUnique({
        where: { university_roll }
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
        university_roll: profile.university_roll,
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


/**
 * Get Student Details By University Roll
 * Public API
 */

exports.getStudentByUniversityRoll = async (req, res, next) => {
  try {

    /* ============================
       1. GET INPUT
    ============================ */

    const { university_roll } = req.body;


    /* ============================
       2. FIND STUDENT
    ============================ */

    const student = await prisma.student.findUnique({
      where: { university_roll }
    });

    if (!student) {
      return next(new AppError("Student not found", 404));
    }


    /* ============================
       3. FETCH FULL PROFILE
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
       4. RESPONSE
    ============================ */

    res.status(200).json({
      status: "success",
      message: "Student fetched successfully",
      data: {

        id: profile.id,
        name: profile.name,
        father_name: profile.father_name,
        mother_name: profile.mother_name,

        reg_no: profile.reg_no,
        uan_no: profile.uan_no,
        university_roll: profile.university_roll,
        class_roll: profile.class_roll,

        phone: profile.phone,
        email: profile.email,

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