/*
  Warnings:

  - You are about to drop the column `approvedById` on the `CertificateRequest` table. All the data in the column will be lost.
  - You are about to drop the column `departmentId` on the `CertificateRequest` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `CertificateRequest` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[certificateNo]` on the table `CertificateRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[certificateId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `courseName` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departmentName` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatherName` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semester` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `session` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `Student` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `Student` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CertificateRequest" DROP CONSTRAINT "CertificateRequest_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "CertificateRequest" DROP CONSTRAINT "CertificateRequest_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "CertificateRequest" DROP CONSTRAINT "CertificateRequest_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_studentId_fkey";

-- AlterTable
ALTER TABLE "CertificateRequest" DROP COLUMN "approvedById",
DROP COLUMN "departmentId",
DROP COLUMN "studentId",
ADD COLUMN     "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "certificateNo" TEXT,
ADD COLUMN     "character" TEXT,
ADD COLUMN     "collegeRoll" TEXT,
ADD COLUMN     "courseName" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "departmentName" TEXT NOT NULL,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "examMonth" TEXT,
ADD COLUMN     "examYear" TEXT,
ADD COLUMN     "fatherName" TEXT NOT NULL,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "registrationNo" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "resultDivision" TEXT,
ADD COLUMN     "semester" TEXT NOT NULL,
ADD COLUMN     "session" TEXT NOT NULL,
ADD COLUMN     "universityRoll" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "certificateId" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- AlterTable
-- ALTER TABLE "Student" ALTER COLUMN "email" SET NOT NULL,
-- ALTER COLUMN "phone" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRequest_certificateNo_key" ON "CertificateRequest"("certificateNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_certificateId_key" ON "Payment"("certificateId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "CertificateRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
