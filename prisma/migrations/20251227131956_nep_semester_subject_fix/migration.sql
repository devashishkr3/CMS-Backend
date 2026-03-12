/*
  Warnings:

  - You are about to drop the column `guardianName` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `credit` on the `Subject` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,semesterId]` on the table `StudentSemester` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code,courseId,semesterId]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `Subject` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('GENERAL', 'BC_I', 'BC_II', 'SC', 'ST', 'EWS');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('MJC', 'MIC', 'MDC', 'SEC', 'VAC');

-- DropIndex
DROP INDEX "Subject_code_courseId_key";

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "admissionNo" TEXT,
ADD COLUMN     "confidentialNo" TEXT,
ADD COLUMN     "meritListType" TEXT,
ADD COLUMN     "profileNo" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bankTxnNo" TEXT;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "guardianName",
ADD COLUMN     "category" "Category",
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "credit",
ADD COLUMN     "type" "SubjectType" NOT NULL;

-- CreateTable
CREATE TABLE "StudentSubject" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,

    CONSTRAINT "StudentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubject_studentId_subjectId_semesterId_key" ON "StudentSubject"("studentId", "subjectId", "semesterId");

-- CreateIndex
CREATE INDEX "Admission_studentId_courseId_idx" ON "Admission"("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSemester_studentId_semesterId_key" ON "StudentSemester"("studentId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_courseId_semesterId_key" ON "Subject"("code", "courseId", "semesterId");

-- AddForeignKey
ALTER TABLE "StudentSubject" ADD CONSTRAINT "StudentSubject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubject" ADD CONSTRAINT "StudentSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubject" ADD CONSTRAINT "StudentSubject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
