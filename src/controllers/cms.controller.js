const prisma = require('../config/prisma');
const AppError = require('../utils/error');
const { logAudit } = require('../utils/auditLogger');
const { 
  createGalleryItem,
  createNewsItem,
  createNoticeItem,
  filterGalleryItems,
  filterNewsItems,
  filterNoticeItems
} = require('../validation/cms.validation');

////////////////////////////////////////
// GALLERY CONTROLLERS
////////////////////////////////////////

/**
 * Create a new gallery item
 * Access: ADMIN
 */
exports.createGalleryItem = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createGalleryItem.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { title, coverUrl } = value;

    // Create gallery item
    const galleryItem = await prisma.gallery.create({
      data: {
        title,
        coverUrl: coverUrl || null
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_GALLERY_ITEM',
      entity: 'Gallery',
      entityId: galleryItem.id,
      payload: { title, coverUrl },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Gallery item created successfully',
      data: {
        galleryItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all gallery items with filtering options
 * Access: PUBLIC (published only), ADMIN (all)
 */
exports.getAllGalleryItems = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = filterGalleryItems.validate(req.query);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { search } = value;

    // Build where clause
    const where = {};

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Get gallery items
    const galleryItems = await prisma.gallery.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: galleryItems.length,
      data: {
        galleryItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get gallery item by ID
 * Access: PUBLIC, ADMIN
 */
exports.getGalleryItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const galleryItem = await prisma.gallery.findUnique({
      where: { id }
    });

    if (!galleryItem) {
      return next(new AppError('Gallery item not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        galleryItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update gallery item
 * Access: ADMIN
 */
exports.updateGalleryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = createGalleryItem.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if gallery item exists
    const galleryItem = await prisma.gallery.findUnique({
      where: { id }
    });

    if (!galleryItem) {
      return next(new AppError('Gallery item not found', 404));
    }

    const { title, coverUrl } = value;

    // Update gallery item
    const updatedGalleryItem = await prisma.gallery.update({
      where: { id },
      data: {
        title: title || galleryItem.title,
        coverUrl: coverUrl !== undefined ? coverUrl : galleryItem.coverUrl
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_GALLERY_ITEM',
      entity: 'Gallery',
      entityId: id,
      payload: { title, coverUrl },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Gallery item updated successfully',
      data: {
        galleryItem: updatedGalleryItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete gallery item
 * Access: ADMIN
 */
exports.deleteGalleryItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if gallery item exists
    const galleryItem = await prisma.gallery.findUnique({
      where: { id }
    });

    if (!galleryItem) {
      return next(new AppError('Gallery item not found', 404));
    }

    // Delete gallery item
    await prisma.gallery.delete({
      where: { id }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_GALLERY_ITEM',
      entity: 'Gallery',
      entityId: id,
      payload: { title: galleryItem.title },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Gallery item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

////////////////////////////////////////
// NEWS CONTROLLERS
////////////////////////////////////////

/**
 * Create a new news item
 * Access: ADMIN
 */
exports.createNewsItem = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createNewsItem.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { title, body, isPublished, url } = value;

    // Create news item
    const newsItem = await prisma.news.create({
      data: {
        title,
        body,
        isPublished: isPublished || false,
        url: url || null
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_NEWS_ITEM',
      entity: 'News',
      entityId: newsItem.id,
      payload: { title, body, isPublished, url },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'News item created successfully',
      data: {
        newsItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all news items with filtering options
 * Access: PUBLIC (published only), ADMIN (all)
 */
exports.getAllNewsItems = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = filterNewsItems.validate(req.query);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { search, isPublished } = value;

    // Build where clause
    const where = {};

    // For non-admin users, only show published news
    if (req.user?.role !== 'ADMIN') {
      where.isPublished = true;
    } else if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get news items
    const newsItems = await prisma.news.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: newsItems.length,
      data: {
        newsItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get news item by ID
 * Access: PUBLIC (published only), ADMIN (all)
 */
exports.getNewsItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const newsItem = await prisma.news.findUnique({
      where: { id }
    });

    if (!newsItem) {
      return next(new AppError('News item not found', 404));
    }

    // For non-admin users, only allow access to published news
    if (req.user?.role !== 'ADMIN' && !newsItem.isPublished) {
      return next(new AppError('News item not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        newsItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update news item
 * Access: ADMIN
 */
exports.updateNewsItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = createNewsItem.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if news item exists
    const newsItem = await prisma.news.findUnique({
      where: { id }
    });

    if (!newsItem) {
      return next(new AppError('News item not found', 404));
    }

    const { title, body, isPublished, url } = value;

    // Update news item
    const updatedNewsItem = await prisma.news.update({
      where: { id },
      data: {
        title: title || newsItem.title,
        body: body || newsItem.body,
        isPublished: isPublished !== undefined ? isPublished : newsItem.isPublished,
        url: url !== undefined ? url : newsItem.url
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_NEWS_ITEM',
      entity: 'News',
      entityId: id,
      payload: { title, body, isPublished, url },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'News item updated successfully',
      data: {
        newsItem: updatedNewsItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete news item
 * Access: ADMIN
 */
exports.deleteNewsItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if news item exists
    const newsItem = await prisma.news.findUnique({
      where: { id }
    });

    if (!newsItem) {
      return next(new AppError('News item not found', 404));
    }

    // Delete news item
    await prisma.news.delete({
      where: { id }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_NEWS_ITEM',
      entity: 'News',
      entityId: id,
      payload: { title: newsItem.title },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'News item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

////////////////////////////////////////
// NOTICE CONTROLLERS
////////////////////////////////////////

/**
 * Create a new notice item
 * Access: ADMIN
 */
exports.createNoticeItem = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createNoticeItem.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { title, body, url } = value;

    // Create notice item
    const noticeItem = await prisma.notice.create({
      data: {
        title,
        body,
        url: url || null
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'CREATE_NOTICE_ITEM',
      entity: 'Notice',
      entityId: noticeItem.id,
      payload: { title, body, url },
      req
    });

    res.status(201).json({
      status: 'success',
      message: 'Notice item created successfully',
      data: {
        noticeItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all notice items with filtering options
 * Access: PUBLIC, ADMIN
 */
exports.getAllNoticeItems = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = filterNoticeItems.validate(req.query);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    const { search } = value;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get notice items
    const noticeItems = await prisma.notice.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: noticeItems.length,
      data: {
        noticeItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notice item by ID
 * Access: PUBLIC, ADMIN
 */
exports.getNoticeItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const noticeItem = await prisma.notice.findUnique({
      where: { id }
    });

    if (!noticeItem) {
      return next(new AppError('Notice item not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        noticeItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notice item
 * Access: ADMIN
 */
exports.updateNoticeItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate request body
    const { error, value } = createNoticeItem.validate(req.body);
    if (error) {
      return next(new AppError(error.details.map(d => d.message).join(', '), 400));
    }

    // Check if notice item exists
    const noticeItem = await prisma.notice.findUnique({
      where: { id }
    });

    if (!noticeItem) {
      return next(new AppError('Notice item not found', 404));
    }

    const { title, body, url } = value;

    // Update notice item
    const updatedNoticeItem = await prisma.notice.update({
      where: { id },
      data: {
        title: title || noticeItem.title,
        body: body || noticeItem.body,
        url: url !== undefined ? url : noticeItem.url
      }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE_NOTICE_ITEM',
      entity: 'Notice',
      entityId: id,
      payload: { title, body, url },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Notice item updated successfully',
      data: {
        noticeItem: updatedNoticeItem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notice item
 * Access: ADMIN
 */
exports.deleteNoticeItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if notice item exists
    const noticeItem = await prisma.notice.findUnique({
      where: { id }
    });

    if (!noticeItem) {
      return next(new AppError('Notice item not found', 404));
    }

    // Delete notice item
    await prisma.notice.delete({
      where: { id }
    });

    // Log audit entry
    await logAudit({
      userId: req.user.id,
      action: 'DELETE_NOTICE_ITEM',
      entity: 'Notice',
      entityId: id,
      payload: { title: noticeItem.title },
      req
    });

    res.status(200).json({
      status: 'success',
      message: 'Notice item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};