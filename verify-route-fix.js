#!/usr/bin/env node

/**
 * Quick Verification Script for Route Handler Fix
 * Run this to verify all middleware and routes are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Route Handler Fix...\n');

// Check fileUpload.js exports
console.log('✅ Checking /src/middlewares/fileUpload.js...');
const fileUploadPath = path.join(__dirname, 'src', 'middlewares', 'fileUpload.js');
const fileUploadContent = fs.readFileSync(fileUploadPath, 'utf8');

const requiredExports = [
  'const uploadMiddleware = upload',
  'module.exports.upload',
  'module.exports.uploadSingleFile',
  'module.exports.uploadMultipleFiles',
  'module.exports.handleFileUploadErrors'
];

let allExportsPresent = true;
requiredExports.forEach(exp => {
  if (fileUploadContent.includes(exp)) {
    console.log(`   ✓ ${exp}`);
  } else {
    console.log(`   ✗ MISSING: ${exp}`);
    allExportsPresent = false;
  }
});

// Check file.routes.js imports
console.log('\n✅ Checking /src/routes/file.routes.js...');
const fileRoutesPath = path.join(__dirname, 'src', 'routes', 'file.routes.js');
const fileRoutesContent = fs.readFileSync(fileRoutesPath, 'utf8');

const requiredImports = [
  'const uploadMiddleware = require',
  'uploadMiddleware.uploadSingleFile',
  'uploadMiddleware.handleFileUploadErrors'
];

let allImportsPresent = true;
requiredImports.forEach(imp => {
  if (fileRoutesContent.includes(imp)) {
    console.log(`   ✓ ${imp}`);
  } else {
    console.log(`   ✗ MISSING: ${imp}`);
    allImportsPresent = false;
  }
});

// Check student.routes.js compatibility
console.log('\n✅ Checking /src/routes/student.routes.js...');
const studentRoutesPath = path.join(__dirname, 'src', 'routes', 'student.routes.js');
const studentRoutesContent = fs.readFileSync(studentRoutesPath, 'utf8');

if (studentRoutesContent.includes("const upload = require('../middlewares/fileUpload')")) {
  console.log('   ✓ Upload middleware imported correctly');
} else {
  console.log('   ✗ Upload middleware import issue');
  allImportsPresent = false;
}

if (studentRoutesContent.includes('upload.single(\'file\')')) {
  console.log('   ✓ Bulk upload route configured');
} else {
  console.log('   ✗ Bulk upload route missing');
  allImportsPresent = false;
}

// Summary
console.log('\n' + '='.repeat(60));
if (allExportsPresent && allImportsPresent) {
  console.log('✅ ALL CHECKS PASSED!');
  console.log('\nYour application should start without errors.');
  console.log('Run: npm run dev\n');
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED!');
  console.log('\nPlease review the missing items above.');
  process.exit(1);
}
