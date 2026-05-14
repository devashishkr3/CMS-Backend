-- Add combined certificate type and separate character PDF fields
ALTER TYPE "CertificateType" ADD VALUE 'CLC_CHARACTER';

ALTER TABLE "CertificateRequest" ADD COLUMN "characterPdfUrl" TEXT;
ALTER TABLE "CertificateRequest" ADD COLUMN "characterCertificateNo" TEXT;

ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_characterCertificateNo_key" UNIQUE ("characterCertificateNo");
