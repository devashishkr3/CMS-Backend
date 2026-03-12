/*
  Warnings:

  - A unique constraint covering the columns `[studentId,semesterId,academicYear]` on the table `Admission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[number,courseId]` on the table `Semester` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYear` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semesterId` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionId` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Admission` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('NEW', 'CONTINUATION');

-- DropIndex
DROP INDEX "Admission_studentId_courseId_idx";

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "academicYear" TEXT NOT NULL,
ADD COLUMN     "semesterId" TEXT NOT NULL,
ADD COLUMN     "sessionId" TEXT NOT NULL,
ADD COLUMN     "type" "AdmissionType" NOT NULL;

-- CreateIndex
CREATE INDEX "Admission_studentId_idx" ON "Admission"("studentId");

-- CreateIndex
CREATE INDEX "Admission_courseId_idx" ON "Admission"("courseId");

-- CreateIndex
CREATE INDEX "Admission_sessionId_idx" ON "Admission"("sessionId");

-- CreateIndex
CREATE INDEX "Admission_semesterId_idx" ON "Admission"("semesterId");

-- CreateIndex
CREATE INDEX "Admission_type_academicYear_idx" ON "Admission"("type", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_studentId_semesterId_academicYear_key" ON "Admission"("studentId", "semesterId", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_number_courseId_key" ON "Semester"("number", "courseId");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
