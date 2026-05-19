const prisma = require("../config/prisma");
const AppError = require("../utils/error");
const { logAudit } = require("../utils/auditLogger");
const {
  applyCertificate,
  createCertificatePayment,
  adminFilterCertificates,
  updateCertificate,
} = require("../validation/certificate.validation");
const {
  createCertificatePayment: createPaymentService,
} = require("../services/certificatePayment.service");
const {
  generateCertificatePDF,
} = require("../services/certificatePdf.service");
const { generateCertificateNo } = require("../utils/certificate.utils");

/**
 * STUDENT: Apply for certificate
 * Access: STUDENT, ADMIN, HOD
 */
exports.applyCertificate = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = applyCertificate.validate(req.body);
    if (error) {
      return next(
        new AppError(error.details.map((d) => d.message).join(", "), 400),
      );
    }

    // Clean up empty strings to null for optional fields
    const cleanData = {
      type: value.type,
      name: value.name.trim(),
      fatherName: value.fatherName.trim(),
      motherName: value.motherName ? value.motherName.trim() : null,
      courseName: value.courseName,
      departmentName: value.departmentName,
      semester: value.semester,
      session: value.session,
      dob: value.dob || null,
      universityRoll: value.universityRoll ? value.universityRoll.trim() : null,
      registrationNo: value.registrationNo ? value.registrationNo.trim() : null,
      collegeRoll: value.collegeRoll ? value.collegeRoll.trim() : null,
      examMonth: value.examMonth ? value.examMonth.trim() : null,
      examYear: value.examYear ? value.examYear.trim() : null,
      resultDivision: value.resultDivision ? value.resultDivision.trim() : null,
      character: value.character ? value.character.trim() : null,
      purpose: value.purpose ? value.purpose.trim() : null,
      status: "PENDING",
    };

    // Create certificate request
    const certificate = await prisma.certificateRequest.create({
      data: cleanData,
    });

    // Log audit
    await logAudit({
      userId: req.user?.id || "anonymous",
      action: "APPLY_CERTIFICATE",
      entity: "CertificateRequest",
      entityId: certificate.id,
      payload: { type: certificate.type, name: certificate.name },
      req,
    });

    res.status(201).json({
      status: "success",
      message: "Certificate application submitted successfully",
      data: {
        certificateId: certificate.id,
        type: certificate.type,
        appliedAt: certificate.appliedAt,
      },
    });
  } catch (error) {
    // Handle Prisma errors
    if (error.code === "P2002") {
      return next(
        new AppError("A certificate with this details already exists", 400),
      );
    }
    if (error.code === "P2003") {
      return next(new AppError("Invalid reference data provided", 400));
    }
    if (error.code === "P2025") {
      return next(new AppError("Record not found", 404));
    }

    // Log unexpected errors
    console.error("Certificate Application Error:", error);
    next(error);
  }
};

/**
 * STUDENT: Create payment for certificate
 * Access: Authenticated users
 */
exports.createPayment = async (req, res, next) => {
  try {
    const { error, value } = createCertificatePayment.validate(req.body);
    if (error) {
      return next(
        new AppError(error.details.map((d) => d.message).join(", "), 400),
      );
    }

    const { certificateId } = value;
    const paymentData = await createPaymentService(certificateId, req);

    res.status(200).json({
      status: "success",
      message: "Payment initiated successfully",
      data: paymentData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ADMIN: Get all certificate applications (with filters)
 * Access: ADMIN only
 */
exports.getAllApplications = async (req, res, next) => {
  try {
    const { error, value } = adminFilterCertificates.validate(req.query);
    if (error) {
      return next(
        new AppError(error.details.map((d) => d.message).join(", "), 400),
      );
    }

    const {
      status,
      type,
      search,
      dob,
      appliedFrom,
      appliedTo,
      page,
      limit,
      sortBy,
      sortOrder,
    } = value;

    // Only show applications with successful payment
    const where = {
      payment: {
        status: "SUCCESS",
      },
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { universityRoll: { contains: search, mode: "insensitive" } },
        { registrationNo: { contains: search, mode: "insensitive" } },
        { collegeRoll: { contains: search, mode: "insensitive" } },
      ];
    }
    if (dob) where.dob = new Date(dob);
    if (appliedFrom || appliedTo) {
      where.appliedAt = {};
      if (appliedFrom) where.appliedAt.gte = new Date(appliedFrom);
      if (appliedTo) where.appliedAt.lte = new Date(appliedTo);
    }

    const skip = (page - 1) * limit;

    const [certificates, total, groupedStatuses] = await Promise.all([
      prisma.certificateRequest.findMany({
        where,
        include: {
          payment: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
              txnId: true,
              receiptNo: true,
              createdAt: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.certificateRequest.count({ where }),
      prisma.certificateRequest.groupBy({
        by: ["status"],
        where,
        _count: {
          status: true,
        },
      }),
    ]);

    const stats = groupedStatuses.reduce(
      (acc, item) => {
        const count = item._count?.status || 0;
        acc.total += count;

        if (item.status === "PENDING") acc.pending = count;
        if (item.status === "APPROVED") acc.approved = count;
        if (item.status === "ISSUED") acc.issued = count;
        if (item.status === "REJECTED") acc.rejected = count;

        return acc;
      },
      {
        total: 0,
        pending: 0,
        approved: 0,
        issued: 0,
        rejected: 0,
      },
    );

    res.status(200).json({
      status: "success",
      results: certificates.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
      data: {
        certificates,
        certificateRequests: certificates,
        stats,
      },
      certificates,
      certificateRequests: certificates,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ADMIN: Get single application
 * Access: ADMIN only
 */
exports.getApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await prisma.certificateRequest.findUnique({
      where: { id },
      include: {
        payment: true,
      },
    });

    if (!certificate) {
      return next(new AppError("Certificate application not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { certificate },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ADMIN: Update application
 * Access: ADMIN only
 */
exports.updateApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateCertificate.validate(req.body);
    if (error) {
      return next(
        new AppError(error.details.map((d) => d.message).join(", "), 400),
      );
    }

    const certificate = await prisma.certificateRequest.findUnique({
      where: { id },
    });

    if (!certificate) {
      return next(new AppError("Certificate application not found", 404));
    }

    // Cannot update if already issued or rejected
    if (["ISSUED", "REJECTED"].includes(certificate.status)) {
      return next(
        new AppError(
          `Cannot update ${certificate.status.toLowerCase()} application`,
          400,
        ),
      );
    }

    const updated = await prisma.certificateRequest.update({
      where: { id },
      data: value,
      include: { payment: true },
    });

    await logAudit({
      userId: req.user.id,
      action: "UPDATE_CERTIFICATE_APPLICATION",
      entity: "CertificateRequest",
      entityId: id,
      payload: value,
      req,
    });

    res.status(200).json({
      status: "success",
      message: "Certificate application updated successfully",
      data: { certificate: updated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ADMIN: Approve application
 * Access: ADMIN only
 *
 * CORRECT FLOW:
 * 1. Generate certificateNo
 * 2. Save certificateNo to DB FIRST
 * 3. Then generate PDF (which requires certificateNo)
 * 4. Update status to ISSUED with pdfUrl
 */
exports.approveApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Step 1: Fetch certificate with payment
    const certificate = await prisma.certificateRequest.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!certificate) {
      return next(new AppError("Certificate application not found", 404));
    }

    // Step 2: Validate payment status
    if (!certificate.payment || certificate.payment.status !== "SUCCESS") {
      return next(
        new AppError("Payment not completed for this certificate", 400),
      );
    }

    // Step 3: Check if already issued
    if (certificate.status === "ISSUED") {
      return next(new AppError("Certificate already issued", 400));
    }

    if (certificate.status === "REJECTED") {
      return next(new AppError("Cannot approve rejected application", 400));
    }

    // Step 4: Generate certificate number FIRST
    const certificateNo = await generateCertificateNo(certificate.type);
    // console.log(`Generated certificate number: ${certificateNo}`);

    // Step 5: Save certificateNo to database BEFORE PDF generation
    const updatedWithCertNo = await prisma.certificateRequest.update({
      where: { id },
      data: {
        certificateNo,
        status: "APPROVED", // Set to APPROVED first
        issuedAt: new Date(), // Set issued date
      },
    });

    // console.log(`Certificate number saved to DB: ${updatedWithCertNo.certificateNo}`);

    // Step 6: Now generate PDF (certificateNo exists in DB now)
    // let pdfUrl = null;
    // try {
    //   const { pdfUrl: generatedPdfUrl } = await generateCertificatePDF(id);
    //   // const { remarks : pdfUrl} = await generateCertificatePDF(id);
    //   pdfUrl = generatedPdfUrl;
    //   // console.log(`PDF generated successfully: ${pdfUrl}`);
    // } catch (pdfError) {
    //   // console.error('PDF generation failed:', pdfError);
    //   // Continue anyway - certificate is approved, PDF can be regenerated later
    //   pdfUrl = null;
    // }

    // ================================
    // GENERATE CLC + CHARACTER BOTH
    // ================================
    let clcPdfUrl = null;
    let characterPdfUrl = null;

    try {
      // 1️⃣ Generate CLC PDF (type already CLC)
      const { pdfUrl: generatedClcPdfUrl } = await generateCertificatePDF(id);

      clcPdfUrl = generatedClcPdfUrl;

      // 2️⃣ Generate Character certificate number
      const characterCertificateNo = await generateCertificateNo("CHARACTER");

      // 3️⃣ Temporarily update record to CHARACTER
      await prisma.certificateRequest.update({
        where: { id },
        data: {
          type: "CHARACTER",
          certificateNo: characterCertificateNo,
        },
      });

      // 4️⃣ Generate Character PDF
      const { pdfUrl: generatedCharacterPdfUrl } =
        await generateCertificatePDF(id);

      characterPdfUrl = generatedCharacterPdfUrl;
    } catch (err) {
      console.error("Dual certificate generation error:", err);
    }

    // Step 7: Final update with PDF URL and ISSUED status
    // const finalCertificate = await prisma.certificateRequest.update({
    //   where: { id },
    //   data: {
    //     status: "ISSUED",
    //     pdfUrl: pdfUrl || certificate.pdfUrl, // Keep old PDF if regeneration failed
    //   },
    //   include: { payment: true },
    // });

    const finalCertificate = await prisma.certificateRequest.update({
      where: { id },
      data: {
        type: "CLC", // restore original type
        status: "ISSUED",
        pdfUrl: clcPdfUrl || certificate.pdfUrl,
        remark: characterPdfUrl || null,
      },
      include: { payment: true },
    });

    // Step 8: Log audit
    await logAudit({
      userId: req.user.id,
      action: "APPROVE_CERTIFICATE",
      entity: "CertificateRequest",
      entityId: id,
      payload: {
        certificateNo,
        type: certificate.type,
        pdfGenerated: !!pdfUrl,
      },
      req,
    });

    res.status(200).json({
      status: "success",
      message: "Certificate approved and issued successfully",
      data: {
        certificate: finalCertificate,
        certificateNo,
        pdfGenerated: !!pdfUrl,
      },
    });
  } catch (error) {
    console.error("Approve Certificate Error:", error);
    next(error);
  }
};

/**
 * ADMIN: Reject application
 * Access: ADMIN only
 */
exports.rejectApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const certificate = await prisma.certificateRequest.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!certificate) {
      return next(new AppError("Certificate application not found", 404));
    }

    if (certificate.status === "ISSUED") {
      return next(new AppError("Cannot reject issued certificate", 400));
    }

    if (certificate.status === "REJECTED") {
      return next(new AppError("Application already rejected", 400));
    }

    const updated = await prisma.certificateRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        remarks: remarks || certificate.remarks,
      },
      include: { payment: true },
    });

    await logAudit({
      userId: req.user.id,
      action: "REJECT_CERTIFICATE",
      entity: "CertificateRequest",
      entityId: id,
      payload: { remarks },
      req,
    });

    res.status(200).json({
      status: "success",
      message: "Certificate application rejected",
      data: { certificate: updated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ADMIN: Update certificate status through frontend-compatible endpoint
 * Access: ADMIN only
 */
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;

    if (!status) {
      return next(new AppError("Status is required", 400));
    }

    if (status === "APPROVED") {
      return exports.approveApplication(req, res, next);
    }

    if (status === "REJECTED") {
      req.body = { remarks };
      return exports.rejectApplication(req, res, next);
    }

    return next(new AppError("Unsupported status update", 400));
  } catch (error) {
    next(error);
  }
};

/**
 * ADMIN/STUDENT: Download CLC + Character Certificate
 * Access: ADMIN, STUDENT (own certificates)
 */
exports.downloadCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await prisma.certificateRequest.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!certificate) {
      return next(new AppError("Certificate not found", 404));
    }

    if (certificate.status !== "ISSUED") {
      return next(new AppError("Certificate not yet issued", 400));
    }

    const clcPdfUrl = certificate.pdfUrl;       // CLC
    const characterPdfUrl = certificate.remark; // Character

    if (!clcPdfUrl && !characterPdfUrl) {
      return next(new AppError("No certificate PDFs available", 404));
    }

    const fs = require("fs");
    const path = require("path");

    const clcPath = path.join(
      __dirname,
      "../../temp/certificates",
      `certificate_${id}.pdf`
    );

    const characterPath = path.join(
      __dirname,
      "../../temp/certificates",
      `certificate_${id}_CHARACTER.pdf`
    );

    const clcExists = fs.existsSync(clcPath);
    const characterExists = fs.existsSync(characterPath);

    // ====================================================
    // CASE 1 → LOCAL FILE EXISTS (Stream or ZIP)
    // ====================================================

    if (clcExists || characterExists) {
      // If both exist → ZIP
      if (clcExists && characterExists) {
        const archiver = require("archiver");

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${certificate.certificateNo}_documents.zip"`
        );

        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(res);

        archive.file(clcPath, { name: "CLC.pdf" });
        archive.file(characterPath, { name: "Character.pdf" });

        await archive.finalize();
        return;
      }

      // If only CLC exists → stream single PDF
      if (clcExists) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${certificate.certificateNo}_CLC.pdf"`
        );

        return fs.createReadStream(clcPath).pipe(res);
      }

      // If only Character exists → stream single PDF
      if (characterExists) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${certificate.certificateNo}_Character.pdf"`
        );

        return fs.createReadStream(characterPath).pipe(res);
      }
    }

    // ====================================================
    // CASE 2 → CLOUD STORAGE URL
    // ====================================================

    // If only CLC exists in cloud
    if (clcPdfUrl && !characterPdfUrl) {
      if (clcPdfUrl.startsWith("http")) {
        return res.redirect(clcPdfUrl);
      }
    }

    // If both cloud URLs exist → return JSON
    return res.status(200).json({
      status: "success",
      message: "Certificate download URLs",
      data: {
        certificateNo: certificate.certificateNo,
        clcPdfUrl: clcPdfUrl || null,
        characterPdfUrl: characterPdfUrl || null,
      },
    });

  } catch (error) {
    console.error("Download Certificate Error:", error);
    next(error);
  }
};

/**
 * ADMIN/STUDENT: Download certificate
 * Access: ADMIN, STUDENT (own certificates)
 */
// exports.downloadCertificate = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     const certificate = await prisma.certificateRequest.findUnique({
//       where: { id },
//       include: { payment: true },
//     });

//     if (!certificate) {
//       return next(new AppError("Certificate not found", 404));
//     }

//     // For students, verify ownership
//     if (req.user.role !== "ADMIN") {
//       // Check if student owns this certificate
//       // Add your student ownership verification logic here
//       // if (certificate.studentId !== req.user.id) {
//       //   return next(new AppError('Unauthorized access', 403));
//       // }
//     }

//     if (certificate.status !== "ISSUED") {
//       return next(new AppError("Certificate not yet issued", 400));
//     }

//     if (!certificate.pdfUrl) {
//       return next(new AppError("Certificate PDF not available", 404));
//     }

//     // Try to serve from temp directory first
//     const fs = require("fs");
//     const path = require("path");
//     const filePath = path.join(
//       __dirname,
//       "../../temp/certificates",
//       `certificate_${id}.pdf`,
//     );

//     if (fs.existsSync(filePath)) {
//       // File exists in temp directory
//       res.setHeader("Content-Type", "application/pdf");
//       res.setHeader(
//         "Content-Disposition",
//         `attachment; filename="${certificate.certificateNo || "certificate"}.pdf"`,
//       );

//       const stream = fs.createReadStream(filePath);
//       stream.on("error", (err) => next(err));
//       stream.pipe(res);
//     } else {
//       // File not in temp, return pdfUrl for frontend to download
//       // This handles cloud storage URLs (R2, S3, etc.)
//       console.log(`PDF file not in temp, returning URL: ${certificate.pdfUrl}`);

//       // If pdfUrl is a full URL, redirect to it
//       if (certificate.pdfUrl.startsWith("http")) {
//         return res.redirect(certificate.pdfUrl);
//       }

//       // Otherwise return the URL in JSON
//       return res.status(200).json({
//         status: "success",
//         message: "Certificate PDF URL",
//         data: {
//           certificateNo: certificate.certificateNo,
//           pdfUrl: certificate.pdfUrl,
//           downloadUrl: `${req.protocol}://${req.get("host")}${certificate.pdfUrl}`,
//         },
//       });
//     }
//   } catch (error) {
//     console.error("Download Certificate Error:", error);
//     next(error);
//   }
// };
