const prisma = require("../config/prisma");
const AppError = require("../utils/error");
const { logAudit } = require("../utils/auditLogger");

/* ==================================================
   PREVIEW PROMOTION
================================================== */
exports.previewAutoPromotion = async (req, res, next) => {
  try {

    const { courseId, sessionId } = req.query;

    const semesters = await prisma.semester.findMany({
      where: { courseId },
      orderBy: { number: "asc" }
    });

    if (!semesters.length) {
      return next(new AppError("No semesters found", 404));
    }

    const result = [];

    for (let i = 0; i < semesters.length; i++) {

      const current = semesters[i];
      const next = semesters[i + 1] || null;

      const count = await prisma.studentSemester.count({

        where: {
          semesterId: current.id,
        //   status: "ONGOING",
        //   feePaid: true,

          student: {
            sessionId,
            status: "ACTIVE"
          }
        }
      });

      result.push({

        from: {
          id: current.id,
          number: current.number
        },

        to: next
          ? { id: next.id, number: next.number }
          : "ALUMNI",

        totalStudents: count
      });
    }

    res.json({
      status: "success",
      data: result
    });

  } catch (err) {
    next(err);
  }
};


/* ==================================================
   CONFIRM PROMOTION
================================================== */
// exports.confirmAutoPromotion = async (req, res, next) => {
//   try {

//     const { courseId, sessionId, academicYear } = req.body;

//     const semesters = await prisma.semester.findMany({
//       where: { courseId },
//       orderBy: { number: "asc" }
//     });

//     if (!semesters.length) {
//       return next(new AppError("No semesters found", 404));
//     }

//     await prisma.$transaction(async (tx) => {

//       for (let i = 0; i < semesters.length; i++) {

//         const current = semesters[i];
//         const next = semesters[i + 1] || null;

//         const students = await tx.studentSemester.findMany({

//           where: {
//             semesterId: current.id,
//             status: "ONGOING",
//             // feePaid: true,

//             student: {
//               sessionId,
//               status: "ACTIVE"
//             }
//           }
//         });

//         for (const s of students) {

//           /* Close current semester */
//           await tx.studentSemester.update({
//             where: { id: s.id },
//             data: {
//               status: "PROMOTED",
//               endDate: new Date()
//             }
//           });


//           /* LAST SEMESTER → ALUMNI */
//           if (!next) {

//             await tx.student.update({
//               where: { id: s.studentId },
//               data: { status: "ALUMNI" }
//             });

//             continue;
//           }


//           /* Duplicate Check */
//           const exists = await tx.studentSemester.findUnique({
//             where: {
//               studentId_semesterId: {
//                 studentId: s.studentId,
//                 semesterId: next.id
//               }
//             }
//           });

//           if (exists) continue;


//           /* Assign Next Semester */
//           await tx.studentSemester.create({

//             data: {
//               studentId: s.studentId,
//               semesterId: next.id,
//               status: "ONGOING",
//               feePaid: false,
//               startDate: new Date()
//             }
//           });


//           /* Create Admission */
//           await tx.admission.create({

//             data: {
//               studentId: s.studentId,
//               courseId,
//               sessionId,
//               semesterId: next.id,
//               academicYear,
//               type: "CONTINUATION",
//               status: "PAYMENT_PENDING"
//             }
//           });


//           /* Auto Subject Assign */
//         //   const subjects = await tx.subject.findMany({
//         //     where: { semesterId: next.id }
//         //   });

//         //   if (subjects.length) {

//         //     await tx.studentSubject.createMany({

//         //       data: subjects.map(sub => ({
//         //         studentId: s.studentId,
//         //         subjectId: sub.id,
//         //         semesterId: next.id
//         //       })),

//         //       skipDuplicates: true
//         //     });
//         //   }
//         }
//       }

//     });


//     /* AUDIT */
//     await logAudit({
//       userId: req.user.id,
//       action: "AUTO_PROMOTION",
//       entity: "StudentSemester",
//       entityId: courseId,
//       payload: { courseId, sessionId, academicYear },
//       req
//     });


//     res.json({
//       status: "success",
//       message: "Students promoted successfully"
//     });

//   } catch (err) {
//     next(err);
//   }
// };


exports.confirmAutoPromotion = async (req, res, next) => {
  try {

    const { courseId, sessionId, academicYear } = req.body;

    if (!academicYear) {
      return next(new AppError("academicYear is required", 400));
    }

    const semesters = await prisma.semester.findMany({
      where: { courseId },
      orderBy: { number: "asc" }
    });

    if (!semesters.length) {
      return next(new AppError("No semesters found", 404));
    }

    await prisma.$transaction(async (tx) => {

      for (let i = 0; i < semesters.length; i++) {

        const current = semesters[i];
        const next = semesters[i + 1] || null;

        /* Get all students ONCE */
        const students = await tx.studentSemester.findMany({
          where: {
            semesterId: current.id,
            status: "ONGOING",
            student: {
              sessionId,
              status: "ACTIVE"
            }
          }
        });

        if (!students.length) continue;

        const studentIds = students.map(s => s.studentId);

        /* 1️⃣ Close current semester (BULK) */
        await tx.studentSemester.updateMany({
          where: {
            id: { in: students.map(s => s.id) }
          },
          data: {
            status: "ONGOING",
            endDate: new Date()
          }
        });

        /* LAST SEMESTER */
        if (!next) {

          await tx.student.updateMany({
            where: {
              id: { in: studentIds }
            },
            data: {
              status: "ALUMNI"
            }
          });

          continue;
        }


        /* 2️⃣ Get existing next semester records */
        const existing = await tx.studentSemester.findMany({
          where: {
            semesterId: next.id,
            studentId: { in: studentIds }
          },
          select: { studentId: true }
        });

        const existingIds = new Set(
          existing.map(e => e.studentId)
        );


        /* 3️⃣ Prepare new semester entries */
        const newSemesterEntries = students
          .filter(s => !existingIds.has(s.studentId))
          .map(s => ({
            studentId: s.studentId,
            semesterId: next.id,
            status: "ONGOING",
            feePaid: false,
            startDate: new Date()
          }));


        if (newSemesterEntries.length) {

          await tx.studentSemester.createMany({
            data: newSemesterEntries,
            skipDuplicates: true
          });
        }


        /* 4️⃣ Create admissions (BULK) */
        const admissions = newSemesterEntries.map(s => ({
          studentId: s.studentId,
          courseId,
          sessionId,
          semesterId: next.id,
          academicYear,
          type: "CONTINUATION",
          status: "PAYMENT_PENDING"
        }));


        if (admissions.length) {

          await tx.admission.createMany({
            data: admissions,
            skipDuplicates: true
          });
        }

      }

    }, {
      timeout: 60000 // 60 sec (important)
    });


    /* AUDIT */
    await logAudit({
      userId: req.user.id,
      action: "AUTO_PROMOTION",
      entity: "StudentSemester",
      entityId: courseId,
      payload: { courseId, sessionId, academicYear },
      req
    });


    res.json({
      status: "success",
      message: "Students promoted successfully"
    });

  } catch (err) {
    next(err);
  }
};
