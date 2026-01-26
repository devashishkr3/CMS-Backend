exports.getUploadUrl = async (req, res, next) => {
  const { fileType, fileName, mimeType } = req.body;

  const folderMap = {
    photo: "students/photos",
    document: "students/documents",
    signature: "students/signatures",
    notice: "cms/notices",
    news: "cms/news",
    gallery: "cms/gallery"
  };

  const folder = folderMap[fileType];

  const data = await fileService.generateUploadUrl(folder, fileName, mimeType);

  res.json({
    status: "success",
    data
  });
};
