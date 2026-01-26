exports.calculateSemesterFee = async (studentId, semesterId) => {

  const prisma = require('../config/prisma');

  const student = await prisma.student.findUnique({
    where: { id: studentId }
  });

  if (!student) throw new Error('Student not found');

  const fees = await prisma.feeStructure.findMany({
    where: {
      courseId: student.courseId,
      semesterId
    }
  });

  if (!fees.length) {
    throw new Error('Fee not configured');
  }

  let total = 0;

  fees.forEach(f => {
    total += Number(f.amount);
  });

  return {
    total,
    breakups: fees
  };
};
