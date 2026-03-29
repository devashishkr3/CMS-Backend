const xlsx = require('xlsx');
const { sanitizeImportedText, sanitizeUniversityRoll } = require('./studentSanitizer');

/**
 * Parse Excel file and extract student data
 * @param {Buffer} fileBuffer - Excel file buffer
 * @returns {Array} - Array of student objects
 */
exports.parseExcelStudents = (fileBuffer) => {
  try {
    // Read Excel file from buffer
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = xlsx.utils.sheet_to_json(worksheet);
    
    // Map and clean data
    const students = rawData.map((row, index) => {
      // Skip header row if present
      if (index === 0 && typeof row['S No.'] === 'string') {
        return null;
      }
      
      // Clean and normalize data
      const name = sanitizeImportedText(row['name']) || '';
      const fatherName = sanitizeImportedText(row['fatherName']) || '';
      const university_roll = sanitizeUniversityRoll(row['university_roll']) || '';
      const class_roll = row['class_roll']?.toString().trim() || '';
      
      // Validate required fields
      if (!name || !fatherName || !university_roll) {
        return null;
      }
      
      return {
        name,
        fatherName,
        university_roll,
        class_roll: class_roll || undefined,
        majorSubject: row['MAJOR SUBJECT']?.toString().trim() || undefined,
        minorSubject: row['MINOR SUBJECT']?.toString().trim() || undefined
      };
    }).filter(student => student !== null);
    
    return {
      success: true,
      count: students.length,
      data: students
    };
  } catch (error) {
    console.error('Excel parsing error:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

/**
 * Validate parsed student data
 * @param {Array} students - Array of student objects
 * @returns {Object} - Validation result
 */
exports.validateParsedStudents = (students) => {
  const errors = [];
  const validStudents = [];
  
  students.forEach((student, index) => {
    const rowErrors = [];
    
    // Validate name
    if (!student.name || student.name.length < 2) {
      rowErrors.push(`Invalid name at row ${index + 1}`);
    }
    
    // Validate fatherName
    if (!student.fatherName || student.fatherName.length < 2) {
      rowErrors.push(`Invalid father name at row ${index + 1}`);
    }
    
    // Validate university_roll
    if (!student.university_roll || student.university_roll.length < 5) {
      rowErrors.push(`Invalid university roll at row ${index + 1}`);
    }
    
    if (rowErrors.length > 0) {
      errors.push({
        row: index + 1,
        errors: rowErrors
      });
    } else {
      validStudents.push(student);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    validStudents,
    totalRecords: students.length,
    validCount: validStudents.length,
    invalidCount: errors.length
  };
};
