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

exports.approveApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await prisma.certificateRequest.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!certificate) {
      return next(new AppError("Certificate application not found", 404));
    }

    if (!certificate.payment || certificate.payment.status !== "SUCCESS") {
      return next(
        new AppError("Payment not completed for this certificate", 400),
      );
    }

    if (certificate.status === "ISSUED") {
      return next(new AppError("Certificate already issued", 400));
    }

    if (certificate.status === "REJECTED") {
      return next(new AppError("Cannot approve rejected application", 400));
    }

    const certType = certificate.type || "CLC";

    if (certType === "BONAFIDE") {
      // ✅ Generate Bonafide Certificate
      const bonafideCertNo = await generateCertificateNo("BONAFIDE");

      await prisma.certificateRequest.update({
        where: { id },
        data: {
          certificateNo: bonafideCertNo,
          status: "APPROVED",
          issuedAt: new Date(),
        },
      });

      const { pdfUrl } = await generateCertificatePDF(id, {
        type: "BONAFIDE",
        certificateNo: bonafideCertNo,
      });

      const finalCertificate = await prisma.certificateRequest.update({
        where: { id },
        data: {
          status: "ISSUED",
          pdfUrl: pdfUrl,
          remarks: null,
        },
        include: { payment: true },
      });

      return res.status(200).json({
        status: "success",
        message: "Bonafide certificate issued successfully",
        data: {
          certificate: finalCertificate,
          certificateNo: bonafideCertNo,
          pdfUrl,
        },
      });
    } else if (certType === "CHARACTER") {
      // ✅ Generate Character Certificate only
      const charCertNo = await generateCertificateNo("CHARACTER");

      await prisma.certificateRequest.update({
        where: { id },
        data: {
          certificateNo: charCertNo,
          status: "APPROVED",
          issuedAt: new Date(),
        },
      });

      const { pdfUrl } = await generateCertificatePDF(id, {
        type: "CHARACTER",
        certificateNo: charCertNo,
      });

      const finalCertificate = await prisma.certificateRequest.update({
        where: { id },
        data: {
          status: "ISSUED",
          pdfUrl: pdfUrl,
          remarks: null,
        },
        include: { payment: true },
      });

      return res.status(200).json({
        status: "success",
        message: "Character certificate issued successfully",
        data: {
          certificate: finalCertificate,
          certificateNo: charCertNo,
          pdfUrl,
        },
      });
    } else {
      // ✅ Default / CLC: Generate CLC + Character dual certificates
      const clcCertificateNo = await generateCertificateNo("CLC");

      await prisma.certificateRequest.update({
        where: { id },
        data: {
          certificateNo: clcCertificateNo,
          status: "APPROVED",
          issuedAt: new Date(),
        },
      });

      let clcPdfUrl = null;
      let characterPdfUrl = null;

      try {
        const { pdfUrl } = await generateCertificatePDF(id, {
          type: "CLC",
          certificateNo: clcCertificateNo,
        });

        clcPdfUrl = pdfUrl;

        // ✅ Derive Character certificate number from CLC certificate number
        const characterCertificateNo = clcCertificateNo.replace("/CLC/", "/CHARACTER/");

        const { pdfUrl: charPdf } = await generateCertificatePDF(id, {
          type: "CHARACTER",
          certificateNo: characterCertificateNo,
        });

        characterPdfUrl = charPdf;
      } catch (err) {
        console.error("Dual certificate generation error:", err);
      }

      const finalCertificate = await prisma.certificateRequest.update({
        where: { id },
        data: {
          status: "ISSUED",
          pdfUrl: clcPdfUrl,
          remarks: characterPdfUrl,
        },
        include: { payment: true },
      });

      return res.status(200).json({
        status: "success",
        message: "CLC + Character certificate issued successfully",
        data: {
          certificate: finalCertificate,
          clcCertificateNo,
          characterPdfUrl,
        },
      });
    }
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
 * ADMIN/STUDENT: Download CLC Certificate
 * Access: ADMIN, STUDENT (own certificate)
 */
exports.downloadCLCCertificate = async (req, res, next) => {
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

    if (!certificate.pdfUrl) {
      return next(new AppError("Certificate PDF not available", 404));
    }

    const fs = require("fs");
    const path = require("path");
    const type = certificate.type || "CLC";

    const typeFilePath = path.join(
      __dirname,
      "../../temp/certificates",
      `certificate_${id}_${type}.pdf`
    );

    const clcFilePath = path.join(
      __dirname,
      "../../temp/certificates",
      `certificate_${id}_CLC.pdf`
    );

    const filePath = fs.existsSync(typeFilePath) ? typeFilePath : (fs.existsSync(clcFilePath) ? clcFilePath : null);

    // ==============================
    // LOCAL FILE
    // ==============================
    if (filePath && fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}_${certificate.certificateNo || id}.pdf"`
      );

      return fs.createReadStream(filePath).pipe(res);
    }

    // ==============================
    // CLOUD URL
    // ==============================
    if (certificate.pdfUrl.startsWith("http")) {
      return res.redirect(certificate.pdfUrl);
    }

    return res.status(200).json({
      status: "success",
      data: {
        certificateNo: certificate.certificateNo,
        pdfUrl: certificate.pdfUrl,
      },
    });

  } catch (error) {
    console.error("Download Error:", error);
    next(error);
  }
};

/**
 * ADMIN/STUDENT: Download Character Certificate
 * Access: ADMIN, STUDENT (own certificate)
 */
exports.downloadCharacterCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const certificate = await prisma.certificateRequest.findUnique({
      where: { id },
    });

    if (!certificate) {
      return next(new AppError("Certificate not found", 404));
    }

    if (certificate.status !== "ISSUED") {
      return next(new AppError("Certificate not yet issued", 400));
    }

    if (!certificate.remarks) {
      return next(new AppError("Character Certificate PDF not available", 404));
    }

    const fs = require("fs");
    const path = require("path");

    const filePath = path.join(
      __dirname,
      "../../temp/certificates",
      `certificate_${id}_CHARACTER.pdf`
    );

    // ==============================
    // LOCAL FILE
    // ==============================
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Character_${certificate.certificateNo}.pdf"`
      );

      return fs.createReadStream(filePath).pipe(res);
    }

    // ==============================
    // CLOUD URL
    // ==============================
    if (certificate.remarks.startsWith("http")) {
      return res.redirect(certificate.remarks);
    }

    return res.status(200).json({
      status: "success",
      data: {
        certificateNo: certificate.certificateNo,
        pdfUrl: certificate.remarks,
      },
    });

  } catch (error) {
    console.error("Download Character Error:", error);
    next(error);
  }
};

/**
 * ADMIN/STUDENT: Download CLC + Character Certificate
 * Access: ADMIN, STUDENT (own certificates)
 */
// const archiver = require("archiver");
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

//     if (certificate.status !== "ISSUED") {
//       return next(new AppError("Certificate not yet issued", 400));
//     }

//     const clcPdfUrl = certificate.pdfUrl; // CLC
//     const characterPdfUrl = certificate.remarks; // Character

//     if (!clcPdfUrl && !characterPdfUrl) {
//       return next(new AppError("No certificate PDFs available", 404));
//     }

//     const fs = require("fs");
//     const path = require("path");

//     // const clcPath = path.join(
//     //   __dirname,
//     //   "../../temp/certificates",
//     //   `certificate_${id}.pdf`
//     // );

//     //new paths for dual certificates
//     const clcPath = path.join(
//       __dirname,
//       "../../temp/certificates",
//       `certificate_${id}_CLC.pdf`,
//     );

//     const characterPath = path.join(
//       __dirname,
//       "../../temp/certificates",
//       `certificate_${id}_CHARACTER.pdf`,
//     );

//     const clcExists = fs.existsSync(clcPath);
//     const characterExists = fs.existsSync(characterPath);

//     // ====================================================
//     // CASE 1 → LOCAL FILE EXISTS (Stream or ZIP)
//     // ====================================================

//     if (clcExists || characterExists) {
//       // If both exist → ZIP
//       if (clcExists && characterExists) {
//         res.setHeader("Content-Type", "application/zip");
//         res.setHeader(
//           "Content-Disposition",
//           `attachment; filename="${certificate.certificateNo}_documents.zip"`,
//         );

//         const archive = archiver("zip", { zlib: { level: 9 } });
//         archive.pipe(res);

//         archive.file(clcPath, { name: "CLC.pdf" });
//         archive.file(characterPath, { name: "Character.pdf" });

//         await archive.finalize();
//         return;
//       }

//       // If only CLC exists → stream single PDF
//       if (clcExists) {
//         res.setHeader("Content-Type", "application/pdf");
//         res.setHeader(
//           "Content-Disposition",
//           `attachment; filename="${certificate.certificateNo}_CLC.pdf"`,
//         );

//         return fs.createReadStream(clcPath).pipe(res);
//       }

//       // If only Character exists → stream single PDF
//       if (characterExists) {
//         res.setHeader("Content-Type", "application/pdf");
//         res.setHeader(
//           "Content-Disposition",
//           `attachment; filename="${certificate.certificateNo}_Character.pdf"`,
//         );

//         return fs.createReadStream(characterPath).pipe(res);
//       }
//     }

//     // ====================================================
//     // CASE 2 → CLOUD STORAGE URL
//     // ====================================================

//     // If only CLC exists in cloud
//     if (clcPdfUrl && !characterPdfUrl) {
//       if (clcPdfUrl.startsWith("http")) {
//         return res.redirect(clcPdfUrl);
//       }
//     }

//     // If both cloud URLs exist → return JSON
//     return res.status(200).json({
//       status: "success",
//       message: "Certificate download URLs",
//       data: {
//         certificateNo: certificate.certificateNo,
//         clcPdfUrl: clcPdfUrl || null,
//         characterPdfUrl: characterPdfUrl || null,
//       },
//     });
//   } catch (error) {
//     console.error("Download Certificate Error:", error);
//     // await browser.close();
//     next(error);
//   }
// };
