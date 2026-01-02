const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Get admin dashboard statistics
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Total students count
    const totalStudents = await prisma.student.count({
      where: {
        isDeleted: false
      }
    });

    // Today's admissions count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysAdmissions = await prisma.admission.count({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    // This year's admissions count
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const endOfYear = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);

    const thisYearAdmissions = await prisma.admission.count({
      where: {
        createdAt: {
          gte: startOfYear,
          lte: endOfYear
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        totalStudents,
        todaysAdmissions,
        thisYearAdmissions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get last 10 admissions
 */
exports.getLast10Admissions = async (req, res, next) => {
  try {
    const last10Admissions = await prisma.admission.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            reg_no: true,
            phone: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      results: last10Admissions.length,
      data: {
        admissions: last10Admissions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get monthly admissions for the current year
 */
exports.getMonthlyAdmissions = async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Array to hold monthly counts
    const monthlyAdmissions = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      year: currentYear,
      monthName: new Date(0, i).toLocaleString('default', { month: 'short' }),
      count: 0
    }));

    // Get actual admissions data grouped by month
    const admissionsData = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as month,
        COUNT(*) as count
      FROM "Admission"
      WHERE EXTRACT(YEAR FROM "createdAt") = ${currentYear}
      GROUP BY EXTRACT(MONTH FROM "createdAt")
      ORDER BY EXTRACT(MONTH FROM "createdAt")
    `;

    // Update the monthlyAdmissions array with actual counts
    admissionsData.forEach((row) => {
      const monthIndex = Number(row.month) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyAdmissions[monthIndex].count = Number(row.count);
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        monthlyAdmissions,
        year: currentYear
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student counts by status
 */
exports.getStudentCountsByStatus = async (req, res, next) => {
  try {
    const statusCounts = await prisma.student.groupBy({
      by: ['status'],
      where: {
        isDeleted: false
      },
      _count: {
        _all: true
      }
    });

    // Create an object with all possible statuses and their counts
    const allStatuses = {
      ACTIVE: 0,
      SUSPENDED: 0,
      PASSED_OUT: 0,
      ALUMNI: 0,
      DROPOUT: 0
    };

    statusCounts.forEach(item => {
      allStatuses[item.status] = item._count._all;
    });

    res.status(200).json({
      status: 'success',
      data: {
        counts: allStatuses
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ===============================
 * LAST ADMISSIONS (SEARCH + FILTER + PAGINATION)
 * ===============================
 */
// exports.getLast10Admissions = async (req, res, next) => {
//   try {
//     let {
//       page = 1,
//       limit = 10,
//       search,
//       courseId,
//       status,
//       fromDate,
//       toDate,
//     } = req.query;

//     page = parseInt(page);
//     limit = parseInt(limit);

//     const skip = (page - 1) * limit;

//     /**
//      * ===============================
//      * WHERE CONDITION
//      * ===============================
//      */
//     const where = {};

//     // 🔎 SEARCH
//     if (search) {
//       where.OR = [
//         {
//           student: {
//             name: {
//               contains: search,
//               mode: "insensitive",
//             },
//           },
//         },
//         {
//           student: {
//             reg_no: {
//               contains: search,
//               mode: "insensitive",
//             },
//           },
//         },
//         {
//           student: {
//             phone: {
//               contains: search,
//             },
//           },
//         },
//         {
//           admissionNo: {
//             contains: search,
//             mode: "insensitive",
//           },
//         },
//         {
//           profileNo: {
//             contains: search,
//             mode: "insensitive",
//           },
//         },
//       ];
//     }

//     // 🎯 FILTERS
//     if (courseId) {
//       where.courseId = courseId;
//     }

//     if (status) {
//       where.status = status;
//     }

//     // 📅 DATE RANGE
//     if (fromDate || toDate) {
//       where.createdAt = {};
//       if (fromDate) where.createdAt.gte = new Date(fromDate);
//       if (toDate) where.createdAt.lte = new Date(toDate);
//     }

//     /**
//      * ===============================
//      * QUERY
//      * ===============================
//      */
//     const [total, admissions] = await Promise.all([
//       prisma.admission.count({ where }),

//       prisma.admission.findMany({
//         where,
//         orderBy: {
//           createdAt: "desc",
//         },
//         skip,
//         take: limit,
//         include: {
//           student: {
//             select: {
//               id: true,
//               name: true,
//               reg_no: true,
//               phone: true,
//             },
//           },
//           course: {
//             select: {
//               id: true,
//               name: true,
//               code: true,
//             },
//           },
//         },
//       }),
//     ]);

//     res.status(200).json({
//       success: true,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//       data: admissions,
//     });
//   } catch (error) {
//     next(error);
//   }
// };
