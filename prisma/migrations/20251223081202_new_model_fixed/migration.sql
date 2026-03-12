/*
  Warnings:

  - The values [DRAFT,SUBMITTED,APPROVED,PAID,REJECTED] on the enum `AdmissionStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [TC] on the enum `CertificateType` will be removed. If these variants are still used in the database, this will fail.
  - The values [STAFF] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `documents` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `formData` on the `Admission` table. All the data in the column will be lost.
  - You are about to drop the column `hodId` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `Notice` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `Alumni` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GraduationRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StaffProfile` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[txnId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[receiptNo]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reg_no]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uan_no]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `studentId` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `AdmissionWindow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departmentId` to the `CertificateRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiptNo` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Made the column `studentId` on table `Payment` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `uan_no` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `StudentSemester` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FeeHead" AS ENUM ('TUITION', 'EXAM', 'INFRASTRUCTURE', 'DEVELOPMENT', 'CERTIFICATE', 'MISC');

-- CreateEnum
CREATE TYPE "SemesterStatus" AS ENUM ('ONGOING', 'COMPLETED', 'FAILED', 'PROMOTED');

-- AlterEnum
BEGIN;
CREATE TYPE "AdmissionStatus_new" AS ENUM ('INITIATED', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "Admission" ALTER COLUMN "status" TYPE "AdmissionStatus_new" USING ("status"::text::"AdmissionStatus_new");
ALTER TABLE "AdmissionHistory" ALTER COLUMN "fromStatus" TYPE "AdmissionStatus_new" USING ("fromStatus"::text::"AdmissionStatus_new");
ALTER TABLE "AdmissionHistory" ALTER COLUMN "toStatus" TYPE "AdmissionStatus_new" USING ("toStatus"::text::"AdmissionStatus_new");
ALTER TYPE "AdmissionStatus" RENAME TO "AdmissionStatus_old";
ALTER TYPE "AdmissionStatus_new" RENAME TO "AdmissionStatus";
DROP TYPE "AdmissionStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CertificateType_new" AS ENUM ('BONAFIDE', 'CLC');
ALTER TABLE "CertificateRequest" ALTER COLUMN "type" TYPE "CertificateType_new" USING ("type"::text::"CertificateType_new");
ALTER TYPE "CertificateType" RENAME TO "CertificateType_old";
ALTER TYPE "CertificateType_new" RENAME TO "CertificateType";
DROP TYPE "CertificateType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'HOD', 'ACCOUNTANT');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'HOD';
COMMIT;

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Alumni" DROP CONSTRAINT "Alumni_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_hodId_fkey";

-- DropForeignKey
ALTER TABLE "GraduationRecord" DROP CONSTRAINT "GraduationRecord_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "StaffProfile" DROP CONSTRAINT "StaffProfile_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "StaffProfile" DROP CONSTRAINT "StaffProfile_userId_fkey";

-- AlterTable
ALTER TABLE "Admission" DROP COLUMN "createdAt",
DROP COLUMN "documents",
DROP COLUMN "email",
DROP COLUMN "formData",
ADD COLUMN     "studentId" TEXT NOT NULL,
ALTER COLUMN "departmentId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'INITIATED';

-- AlterTable
ALTER TABLE "AdmissionHistory" ADD COLUMN     "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "AdmissionWindow" ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "CertificateRequest" ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "departmentId" TEXT NOT NULL,
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "pdfUrl" TEXT;

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "hodId",
ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "Notice" DROP COLUMN "scope",
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "amount",
ADD COLUMN     "receiptNo" TEXT NOT NULL,
ADD COLUMN     "referenceNo" TEXT,
ADD COLUMN     "totalAmount" DECIMAL(65,30) NOT NULL,
ALTER COLUMN "studentId" SET NOT NULL,
ALTER COLUMN "receiptUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "passwordHash",
ADD COLUMN     "class_roll" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reg_no" TEXT,
ADD COLUMN     "uan_no" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StudentSemester" DROP COLUMN "status",
ADD COLUMN     "status" "SemesterStatus" NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'HOD';

-- DropTable
DROP TABLE "Alumni";

-- DropTable
DROP TABLE "GraduationRecord";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "StaffProfile";

-- DropEnum
DROP TYPE "NoticeScope";

-- DropEnum
DROP TYPE "NotificationChannel";

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationNotes" TEXT,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBreakup" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "head" "FeeHead" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PaymentBreakup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "refundedById" TEXT NOT NULL,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentBreakup_head_idx" ON "PaymentBreakup"("head");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txnId_key" ON "Payment"("txnId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Student_reg_no_key" ON "Student"("reg_no");

-- CreateIndex
CREATE UNIQUE INDEX "Student_uan_no_key" ON "Student"("uan_no");

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBreakup" ADD CONSTRAINT "PaymentBreakup_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
