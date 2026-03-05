<!-- async function promoteStudents(){

 const active = await prisma.studentSemester.findMany({
   where:{
     status:"ONGOING",
     feePaid:true
   },
   include:{ student:true, semester:true }
 });

 for(const rec of active){

   const next = await prisma.semester.findFirst({
     where:{
       courseId: rec.semester.courseId,
       number: rec.semester.number + 1
     }
   });

   if(!next){
     await prisma.student.update({
       where:{ id: rec.studentId },
       data:{ status:"PASSED_OUT" }
     });
     continue;
   }

   await prisma.studentSemester.create({
     data:{
       studentId:rec.studentId,
       semesterId:next.id,
       status:"ONGOING",
       startDate:new Date()
     }
   });

   await prisma.studentSemester.update({
     where:{ id:rec.id },
     data:{ status:"PROMOTED", endDate:new Date() }
   });
 }
} -->

