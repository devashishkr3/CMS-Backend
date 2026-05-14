-- Remove optional PDF URL column (certificates are generated on download only)
ALTER TABLE "CertificateRequest" DROP COLUMN IF EXISTS "characterPdfUrl";
