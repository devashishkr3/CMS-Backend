const { applyCertificate } = require('./src/validation/certificate.validation');

// Test valid data
const validData = {
  type: 'BONAFIDE',
  name: 'Test User',
  fatherName: 'Test Father',
  courseName: 'BSC',
  departmentName: 'PHYSICS',
  semester: '8th',
  session: '2023-2026'
};

const { error: validError } = applyCertificate.validate(validData);

if (validError) {
  console.log('❌ VALID data failed validation:');
  console.log(validError.message);
} else {
  console.log('✅ Valid data passed validation');
}

// Test invalid course
const invalidCourseData = {
  ...validData,
  courseName: 'MBA' // Invalid
};

const { error: courseError } = applyCertificate.validate(invalidCourseData);

if (courseError) {
  console.log('\n✅ Invalid course correctly rejected:');
  console.log(courseError.message);
} else {
  console.log('\n❌ Invalid course should have been rejected');
}

// Test short name
const shortNameData = {
  ...validData,
  name: 'Ab' // Too short
};

const { error: nameError } = applyCertificate.validate(shortNameData);

if (nameError) {
  console.log('\n✅ Short name correctly rejected:');
  console.log(nameError.message);
} else {
  console.log('\n❌ Short name should have been rejected');
}

console.log('\n✅ All validation tests completed successfully!');
