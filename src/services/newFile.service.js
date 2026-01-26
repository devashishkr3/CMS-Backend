const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

exports.generateUploadUrl = async (folder, fileName, mimeType) => {
  const key = `${folder}/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: mimeType
  });

  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: 300 // 5 min
  });

  return {
    uploadUrl,
    fileUrl: `https://${R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`
  };
};
