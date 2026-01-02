const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Get all semesters with filtering options
 * Access: ADMIN, HOD
 */
exports.getAllSemesters = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    
    // Build where clause
    const where = {};
    
    if (courseId) {
      where.courseId = courseId;
    }

    const semesters = await prisma.semester.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        subjects: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true
          }
        },
        studentSemesters: {
          select: {
            id: true,
            student: {
              select: {
                id: true,
                name: true,
                reg_no: true
              }
            },
            status: true,
            feePaid: true
          }
        }
      },
      orderBy: {
        number: 'asc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: semesters.length,
      data: {
        semesters
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get semester by ID
 * Access: ADMIN, HOD
 */
exports.getSemester = async (req, res, next) => {
  try {
    const { id } = req.params;

    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            durationYears: true
          }
        },
        subjects: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true
          }
        },
        studentSemesters: {
          where: {
            status: {
              not: 'FAILED'
            }
          },
          select: {
            id: true,
            student: {
              select: {
                id: true,
                name: true,
                reg_no: true,
                email: true
              }
            },
            status: true,
            feePaid: true,
            startDate: true,
            endDate: true
          }
        }
      }
    });

    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        semester
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Auto-assign students to semester based on criteria
 * Access: ADMIN, HOD
 */
exports.autoAssignStudents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { criteria } = req.body;

    // Check if semester exists
    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        course: true
      }
    });

    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }

    // Build where clause for student selection
    const where = {
      courseId: semester.courseId,
      status: 'ACTIVE'
    };

    // Add additional criteria if provided
    if (criteria) {
      if (criteria.sessionId) {
        where.sessionId = criteria.sessionId;
      }
      
      if (criteria.minSemesterNumber !== undefined) {
        // Students who have completed at least minSemesterNumber semesters
        where.semesters = {
          some: {
            semester: {
              number: {
                lte: criteria.minSemesterNumber
              }
            },
            status: 'COMPLETED'
          }
        };
      }
    }

    // Get eligible students
    const students = await prisma.student.findMany({
      where,
      include: {
        semesters: {
          include: {
            semester: true
          },
          orderBy: {
            startDate: 'desc'
          }
        }
      }
    });

    // Filter students who are eligible for this semester
    const eligibleStudents = students.filter(student => {
      // Check if student is already assigned to this semester
      const isAlreadyAssigned = student.semesters.some(
        ss => ss.semesterId === id
      );
      
      if (isAlreadyAssigned) {
        return false;
      }
      
      // Check if student already has an ongoing semester
      const hasOngoingSemester = student.semesters.some(
        ss => ss.status === 'ONGOING'
      );
      
      if (hasOngoingSemester) {
        return false; // Student cannot have multiple ongoing semesters
      }
      
      // For semester 1, all active students in the course are eligible
      if (semester.number === 1) {
        return true;
      }
      
      // For other semesters, student must have completed the previous semester
      const previousSemesterNumber = semester.number - 1;
      const completedPreviousSemester = student.semesters.some(
        ss => ss.semester.number === previousSemesterNumber && ss.status === 'COMPLETED'
      );
      
      return completedPreviousSemester;
    });

    // Batch create student semester assignments
    const assignments = [];
    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(today.getMonth() + 6); // Default 6 months duration

    for (const student of eligibleStudents) {
      assignments.push({
        studentId: student.id,
        semesterId: id,
        status: 'ONGOING',
        feePaid: false,
        startDate: today,
        endDate: endDate
      });
    }

    // Create all assignments in a transaction
    const studentSemesters = await prisma.$transaction(
      assignments.map(assignment =>
        prisma.studentSemester.create({
          data: assignment,
          include: {
            student: {
              select: {
                id: true,
                name: true,
                reg_no: true
              }
            },
            semester: {
              select: {
                id: true,
                number: true
              }
            }
          }
        })
      )
    );

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'AUTO_ASSIGN_STUDENTS_TO_SEMESTER',
        entity: 'StudentSemester',
        entityId: id,
        payload: JSON.stringify({ 
          semesterId: id, 
          assignedCount: studentSemesters.length,
          criteria 
        })
      }
    });

    res.status(201).json({
      status: 'success',
      message: `${studentSemesters.length} students auto-assigned to semester`,
      data: {
        assignments: studentSemesters
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Promote students to next semester
 * Access: ADMIN, HOD
 */
exports.promoteStudents = async (req, res, next) => {
  try {
    const { id } = req.params; // Current semester ID

    // Check if current semester exists
    const currentSemester = await prisma.semester.findUnique({
      where: { id },
      include: {
        course: true
      }
    });

    if (!currentSemester) {
      return next(new AppError('Current semester not found', 404));
    }

    // Find the next semester
    const nextSemester = await prisma.semester.findFirst({
      where: {
        courseId: currentSemester.courseId,
        number: currentSemester.number + 1
      }
    });

    if (!nextSemester) {
      return next(new AppError(`Next semester (Semester ${currentSemester.number + 1}) not found for this course`, 404));
    }

    // Get students who have completed the current semester
    const completedStudents = await prisma.studentSemester.findMany({
      where: {
        semesterId: id,
        status: 'COMPLETED'
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        }
      }
    });

    // Check which students are already assigned to the next semester
    const existingAssignments = await prisma.studentSemester.findMany({
      where: {
        semesterId: nextSemester.id,
        studentId: {
          in: completedStudents.map(cs => cs.student.id)
        }
      },
      select: {
        studentId: true
      }
    });

    const existingStudentIds = new Set(existingAssignments.map(ea => ea.studentId));

    // Prepare assignments for students not already in next semester
    const newAssignments = completedStudents
      .filter(cs => !existingStudentIds.has(cs.student.id))
      .map(cs => ({
        studentId: cs.student.id,
        semesterId: nextSemester.id,
        status: 'ONGOING',
        feePaid: false,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 6))
      }));

    // Create all new assignments in a transaction
    const promotedAssignments = await prisma.$transaction(
      newAssignments.map(assignment =>
        prisma.studentSemester.create({
          data: assignment,
          include: {
            student: {
              select: {
                id: true,
                name: true,
                reg_no: true
              }
            },
            semester: {
              select: {
                id: true,
                number: true
              }
            }
          }
        })
      )
    );

    // Update current semester status for promoted students
    await prisma.studentSemester.updateMany({
      where: {
        semesterId: id,
        studentId: {
          in: promotedAssignments.map(pa => pa.studentId)
        }
      },
      data: {
        status: 'PROMOTED'
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PROMOTE_STUDENTS_TO_NEXT_SEMESTER',
        entity: 'StudentSemester',
        entityId: id,
        payload: JSON.stringify({ 
          currentSemesterId: id,
          nextSemesterId: nextSemester.id,
          promotedCount: promotedAssignments.length
        })
      }
    });

    res.status(200).json({
      status: 'success',
      message: `${promotedAssignments.length} students promoted to Semester ${nextSemester.number}`,
      data: {
        promotions: promotedAssignments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update student semester status in bulk
 * Access: ADMIN, HOD
 */
exports.bulkUpdateStudentSemesterStatus = async (req, res, next) => {
  try {
    const { id } = req.params; // Semester ID
    const { studentIds, status, feePaid } = req.body;

    // Validate input
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return next(new AppError('Student IDs array is required', 400));
    }

    const validStatuses = ['ONGOING', 'COMPLETED', 'FAILED', 'PROMOTED'];
    if (status && !validStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
    }

    // Check if semester exists
    const semester = await prisma.semester.findUnique({
      where: { id }
    });

    if (!semester) {
      return next(new AppError('Semester not found', 404));
    }

    // Update student semester statuses
    const updates = studentIds.map(studentId =>
      prisma.studentSemester.updateMany({
        where: {
          studentId,
          semesterId: id
        },
        data: {
          status: status || undefined,
          feePaid: feePaid !== undefined ? feePaid : undefined
        }
      })
    );

    await Promise.all(updates);

    // Get updated records
    const updatedRecords = await prisma.studentSemester.findMany({
      where: {
        studentId: {
          in: studentIds
        },
        semesterId: id
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            reg_no: true
          }
        },
        semester: {
          select: {
            id: true,
            number: true
          }
        }
      }
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'BULK_UPDATE_STUDENT_SEMESTER_STATUS',
        entity: 'StudentSemester',
        entityId: id,
        payload: JSON.stringify({ 
          semesterId: id,
          studentIds,
          status,
          feePaid,
          updatedCount: updatedRecords.length
        })
      }
    });
    
    // If status is COMPLETED, auto-promote students to next semester
    if (status === 'COMPLETED') {
      // Find the current semester to get the course
      const currentSemester = await prisma.semester.findUnique({
        where: { id }
      });
      
      if (currentSemester) {
        // Find the next semester in the same course
        const nextSemester = await prisma.semester.findFirst({
          where: {
            courseId: currentSemester.courseId,
            number: currentSemester.number + 1
          }
        });
        
        if (nextSemester) {
          // Process each student who was marked as completed
          for (const record of updatedRecords) {
            // Check if student is already assigned to the next semester
            const existingNextSemesterAssignment = await prisma.studentSemester.findUnique({
              where: {
                studentId_semesterId: {
                  studentId: record.studentId,
                  semesterId: nextSemester.id
                }
              }
            });
            
            if (!existingNextSemesterAssignment) {
              // Auto-assign student to the next semester
              await prisma.studentSemester.create({
                data: {
                  studentId: record.studentId,
                  semesterId: nextSemester.id,
                  status: 'ONGOING',
                  feePaid: false,
                  startDate: new Date(),
                  endDate: null // Will be set when semester completes
                }
              });
              
              // Log audit entry for promotion
              await prisma.auditLog.create({
                data: {
                  userId: req.user.id,
                  action: 'SEMESTER_AUTO_PROMOTION',
                  entity: 'StudentSemester',
                  entityId: record.studentId,
                  payload: JSON.stringify({ 
                    studentId: record.studentId, 
                    semesterId: nextSemester.id,
                    reason: `Auto-promoted from semester ${currentSemester.number} to ${currentSemester.number + 1}`
                  })
                }
              });
            }
          }
        }
      }
    }

    res.status(200).json({
      status: 'success',
      message: `${updatedRecords.length} student semester records updated`,
      data: {
        updatedRecords
      }
    });
  } catch (error) {
    next(error);
  }
};