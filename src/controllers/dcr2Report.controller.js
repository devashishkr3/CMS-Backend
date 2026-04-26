const prisma = require('../config/prisma');
const AppError = require('../utils/error');

/**
 * Get DCR-2 Report - Certificate Finance Report
 * Returns certificate payment statistics and recent transactions
 * Access: ADMIN, ACCOUNTANT
 */
exports.getDCR2Report = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // Get last 10 successful certificate payments with full certificate data
    const last10Payments = await prisma.payment.findMany({
      where: {
        certificateId: { not: null },
        status: 'SUCCESS'
      },
      include: {
        certificate: true  // Include ALL certificate fields
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get statistics - COUNT ALL APPLICATIONS (not just with successful payment)
    const [totalApplications, approvedApplications, pendingApplications, rejectedApplications] = await Promise.all([
      // Total: All certificate requests with successful payment
      prisma.certificateRequest.count({
        where: { payment: { status: 'SUCCESS' } }
      }),
      // Approved/Issued: Successful payment AND status ISSUED
      prisma.certificateRequest.count({
        where: { 
          payment: { status: 'SUCCESS' },
          status: 'ISSUED'
        }
      }),
      // Pending: Successful payment BUT status still PENDING
      prisma.certificateRequest.count({
        where: { 
          payment: { status: 'SUCCESS' },
          status: 'PENDING'
        }
      }),
      // Rejected: Successful payment BUT status REJECTED
      prisma.certificateRequest.count({
        where: { 
          payment: { status: 'SUCCESS' },
          status: 'REJECTED'
        }
      })
    ]);

    // Today's collection (certificate payments only)
    const todaysCollection = await prisma.payment.aggregate({
      where: {
        certificateId: { not: null },
        status: 'SUCCESS',
        createdAt: {
          gte: startOfToday,
          lt: endOfToday
        }
      },
      _sum: { totalAmount: true },
      _count: true
    });

    // Total collection (all certificate payments)
    const totalCollection = await prisma.payment.aggregate({
      where: {
        certificateId: { not: null },
        status: 'SUCCESS'
      },
      _sum: { totalAmount: true },
      _count: true
    });

    // Format payments for response
    const formattedPayments = last10Payments.map(p => ({
      paymentId: p.id,
      receiptNo: p.receiptNo,
      txnId: p.txnId,
      amount: Number(p.totalAmount) || 0,  // Ensure number, not NaN
      certificateType: p.certificate?.type || 'N/A',
      certificateNo: p.certificate?.certificateNo || 'N/A',
      name: p.certificate?.name || 'N/A',  // Include name
      fatherName: p.certificate?.fatherName || 'N/A',  // Include father name
      date: p.createdAt ? p.createdAt.toISOString() : null,
      displayDate: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : 'N/A',
      status: p.certificate?.status || 'N/A'
    }));

    const report = {
      reportType: 'DCR-2 - Certificate Finance Report',
      generatedAt: now.toISOString(),
      summary: {
        totalApplications: totalApplications || 0,
        approved: approvedApplications || 0,
        pending: pendingApplications || 0,
        rejected: rejectedApplications || 0,
        approvedApplications: approvedApplications || 0,
        pendingApplications: pendingApplications || 0,
        rejectedApplications: rejectedApplications || 0
      },
      collections: {
        todayCollection: Number(todaysCollection._sum.totalAmount) || 0,
        totalCollection: Number(totalCollection._sum.totalAmount) || 0,
        todaysCollection: {
          amount: Number(todaysCollection._sum.totalAmount) || 0,  // Prevent NaN
          count: todaysCollection._count || 0,
          date: startOfToday.toISOString()
        },
        totalCollectionDetails: {
          amount: Number(totalCollection._sum.totalAmount) || 0,  // Prevent NaN
          count: totalCollection._count || 0
        }
      },
      last10Payments: formattedPayments
    };

    console.log('DCR2 Report Generated:', {
      totalApplications,
      pendingApplications,
      rejectedApplications,
      totalCollection: Number(totalCollection._sum.totalAmount) || 0
    });

    res.status(200).json({
      status: 'success',
      message: 'DCR-2 report generated successfully',
      data: { report }
    });
  } catch (error) {
    console.error('DCR2 Report Error:', error);
    next(error);
  }
};

/**
 * Export DCR-2 Report as CSV
 * Returns downloadable CSV file with certificate payment data
 * Access: ADMIN, ACCOUNTANT
 */
exports.exportDCR2Report = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const where = {
      certificateId: { not: null },
      status: 'SUCCESS'
    };
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }
    
    // Fetch certificate payments
    const payments = await prisma.payment.findMany({
      where,
      include: {
        certificate: {
          select: {
            type: true,
            name: true,
            certificateNo: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Generate CSV
    const csvRows = [
      'Date,Certificate Type,Name,Amount,Transaction ID,Certificate No,Status'
    ];
    
    payments.forEach(p => {
      csvRows.push([
        new Date(p.createdAt).toLocaleDateString('en-IN'),
        p.certificate?.type || '-',
        p.certificate?.name || '-',
        Number(p.totalAmount),
        p.txnId,
        p.certificate?.certificateNo || '-',
        p.certificate?.status || '-'
      ].join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const fileName = `DCR2_Certificate_Report_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};
