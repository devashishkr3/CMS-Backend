const { Parser } = require('json2csv');

/**
 * Generate CSV from payment data for DCR1 report
 * @param {Array} payments - Array of payment objects with student, admission, and breakups
 * @returns {Object} - { csvData, fileName }
 */
exports.generatePaymentCSV = (payments) => {
  try {
    // Flatten the payment data for CSV
    const flattenedData = payments.map(payment => {
      // Calculate total from breakups if available
      const breakupDetails = payment.breakups?.map(b => `${b.head}: ₹${b.amount}`).join(' | ') || 'N/A';
      
      return {
        'Transaction ID': payment.txnId,
        'Receipt No': payment.receiptNo,
        'Bank Txn No': payment.bankTxnNo || 'N/A',
        'Student Name': payment.student?.name || 'N/A',
        'Student Reg No': payment.student?.reg_no || 'N/A',
        'Student University Roll': payment.student?.university_roll || 'N/A',
        'Student Email': payment.student?.email || 'N/A',
        'Admission No': payment.admission?.admissionNo || 'N/A',
        'Course Name': payment.admission?.course?.name || 'N/A',
        'Course Code': payment.admission?.course?.code || 'N/A',
        'Total Amount': `₹${payment.totalAmount}`,
        'Payment Status': payment.status,
        'Payment Gateway': payment.gateway,
        'Fee Breakup': breakupDetails,
        'Transaction Date': new Date(payment.createdAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        'Created At': new Date(payment.createdAt).toISOString()
      };
    });

    // Define fields for CSV
    const fields = [
      { label: 'Transaction ID', value: 'Transaction ID' },
      { label: 'Receipt No', value: 'Receipt No' },
      { label: 'Bank Txn No', value: 'Bank Txn No' },
      { label: 'Student Name', value: 'Student Name' },
      { label: 'Student Reg No', value: 'Student Reg No' },
      { label: 'Student University Roll', value: 'Student University Roll' },
      { label: 'Student Email', value: 'Student Email' },
      { label: 'Admission No', value: 'Admission No' },
      { label: 'Course Name', value: 'Course Name' },
      { label: 'Course Code', value: 'Course Code' },
      { label: 'Total Amount', value: 'Total Amount' },
      { label: 'Payment Status', value: 'Payment Status' },
      { label: 'Payment Gateway', value: 'Payment Gateway' },
      { label: 'Fee Breakup', value: 'Fee Breakup' },
      { label: 'Transaction Date', value: 'Transaction Date' },
      { label: 'Created At', value: 'Created At' }
    ];

    const json2csvParser = new Parser({ fields });
    const csvData = json2csvParser.parse(flattenedData);
    
    // Generate filename with date range
    const fileName = `DCR1_Report_${new Date().toISOString().split('T')[0]}.csv`;
    
    return {
      csvData,
      fileName
    };
  } catch (error) {
    console.error('Error generating CSV:', error.message);
    throw new Error('Failed to generate CSV report');
  }
};

/**
 * Generate Summary CSV for DCR1 report
 * @param {Object} summary - Summary object with collections
 * @param {Date} startDate - Start date of the range
 * @param {Date} endDate - End date of the range
 * @returns {String} - CSV data
 */
exports.generateSummaryCSV = (summary, startDate, endDate) => {
  try {
    const summaryData = [
      {
        'Report Type': 'DCR1 Summary Report',
        'Start Date': new Date(startDate).toLocaleDateString('en-IN'),
        'End Date': new Date(endDate).toLocaleDateString('en-IN'),
        'Generated At': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        'Total Collection Amount': `₹${summary.totalCollection.amount}`,
        'Total Collection Count': summary.totalCollection.count,
        'Average Transaction Value': summary.totalCollection.count > 0 
          ? `₹${(summary.totalCollection.amount / summary.totalCollection.count).toFixed(2)}` 
          : '₹0.00'
      }
    ];

    const fields = [
      { label: 'Report Type', value: 'Report Type' },
      { label: 'Start Date', value: 'Start Date' },
      { label: 'End Date', value: 'End Date' },
      { label: 'Generated At', value: 'Generated At' },
      { label: 'Total Collection Amount', value: 'Total Collection Amount' },
      { label: 'Total Collection Count', value: 'Total Collection Count' },
      { label: 'Average Transaction Value', value: 'Average Transaction Value' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(summaryData);
  } catch (error) {
    console.error('Error generating summary CSV:', error.message);
    throw new Error('Failed to generate summary CSV');
  }
};
