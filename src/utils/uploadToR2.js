// const fs = require("fs");
// const {
//   S3Client,
//   PutObjectCommand
// } = require("@aws-sdk/client-s3");

// const s3 = new S3Client({
//   region: "auto",
//   endpoint: process.env.R2_ENDPOINT,
//   credentials: {
//     accessKeyId: process.env.R2_ACCESS_KEY,
//     secretAccessKey: process.env.R2_SECRET_KEY
//   }
// });

// exports.uploadFileToR2 = async (filePath, key) => {
//   const fileStream = fs.createReadStream(filePath);

//   const command = new PutObjectCommand({
//     Bucket: process.env.R2_BUCKET,
//     Key: key,
//     Body: fileStream,
//     ContentType: "application/pdf"
//   });

//   await s3.send(command);

//   return `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET}/${key}`;
// };


// // const fs = require("fs");
// // const AWS = require("aws-sdk");

// // const s3 = new AWS.S3({
// //   endpoint: process.env.R2_ENDPOINT,
// //   accessKeyId: process.env.R2_ACCESS_KEY,
// //   secretAccessKey: process.env.R2_SECRET_KEY,
// //   signatureVersion: "v4",
// //   region: "auto"
// // });

// // exports.uploadFileToR2 = async (filePath, key) => {
// //   const file = fs.readFileSync(filePath);

// //   const upload = await s3.upload({
// //     Bucket: process.env.R2_BUCKET,
// //     Key: key,
// //     Body: file,
// //     ContentType: "application/pdf"
// //   }).promise();

// //   return upload.Location;
// // };
