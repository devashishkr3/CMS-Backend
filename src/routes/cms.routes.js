const express = require('express');
const router = express.Router();
const { 
  // Gallery routes
  createGalleryItem,
  getAllGalleryItems,
  getGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  
  // News routes
  createNewsItem,
  getAllNewsItems,
  getNewsItem,
  updateNewsItem,
  deleteNewsItem,
  
  // Notice routes
  createNoticeItem,
  getAllNoticeItems,
  getNoticeItem,
  updateNoticeItem,
  deleteNoticeItem
} = require('../controllers/cms.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

////////////////////////////////////////
// GALLERY ROUTES
////////////////////////////////////////

// Get all gallery items (PUBLIC)
router.get('/gallery', getAllGalleryItems);

// Get gallery item by ID (PUBLIC)
router.get('/gallery/:id', getGalleryItem);

// Apply protection middleware to admin routes
router.use('/gallery', protect, restrictTo('ADMIN', 'HOD'));

// Create gallery item (ADMIN)
router.post('/gallery', createGalleryItem);

// Update gallery item (ADMIN)
router.patch('/gallery/:id', updateGalleryItem);

// Delete gallery item (ADMIN)
router.delete('/gallery/:id', deleteGalleryItem);

////////////////////////////////////////
// NEWS ROUTES
////////////////////////////////////////

// Get all news items (PUBLIC for published, ADMIN for all)
router.get('/news', getAllNewsItems);

// Get news item by ID (PUBLIC for published, ADMIN for all)
router.get('/news/:id', getNewsItem);

// Apply protection middleware to admin routes
router.use('/news', protect, restrictTo('ADMIN', 'HOD'));

// Create news item (ADMIN)
router.post('/news', createNewsItem);

// Update news item (ADMIN)
router.patch('/news/:id', updateNewsItem);

// Delete news item (ADMIN)
router.delete('/news/:id', deleteNewsItem);

////////////////////////////////////////
// NOTICE ROUTES
////////////////////////////////////////

// Get all notice items (PUBLIC)
router.get('/notices', getAllNoticeItems);

// Get notice item by ID (PUBLIC)
router.get('/notices/:id', getNoticeItem);

// Apply protection middleware to admin routes
router.use('/notices', protect, restrictTo('ADMIN', 'HOD'));

// Create notice item (ADMIN)
router.post('/notices', createNoticeItem);

// Update notice item (ADMIN)
router.patch('/notices/:id', updateNoticeItem);

// Delete notice item (ADMIN)
router.delete('/notices/:id', deleteNoticeItem);

module.exports = router;