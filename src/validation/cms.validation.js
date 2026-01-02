const Joi = require('joi');

// Validation for creating/updating gallery items
exports.createGalleryItem = Joi.object({
  title: Joi.string().min(1).max(200).required().messages({
    'string.base': 'Title must be a string',
    'string.min': 'Title must be at least 1 character long',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required'
  }),
  coverUrl: Joi.string().uri().optional().messages({
    'string.base': 'Cover URL must be a string',
    'string.uri': 'Cover URL must be a valid URI'
  })
});

// Validation for creating/updating news items
exports.createNewsItem = Joi.object({
  title: Joi.string().min(1).max(200).required().messages({
    'string.base': 'Title must be a string',
    'string.min': 'Title must be at least 1 character long',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required'
  }),
  body: Joi.string().min(1).max(5000).required().messages({
    'string.base': 'Body must be a string',
    'string.min': 'Body must be at least 1 character long',
    'string.max': 'Body cannot exceed 5000 characters',
    'any.required': 'Body is required'
  }),
  isPublished: Joi.boolean().optional().messages({
    'boolean.base': 'isPublished must be a boolean'
  }),
  url: Joi.string().uri().optional().messages({
    'string.base': 'URL must be a string',
    'string.uri': 'URL must be a valid URI'
  })
});

// Validation for creating/updating notice items
exports.createNoticeItem = Joi.object({
  title: Joi.string().min(1).max(200).required().messages({
    'string.base': 'Title must be a string',
    'string.min': 'Title must be at least 1 character long',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required'
  }),
  body: Joi.string().min(1).max(2000).required().messages({
    'string.base': 'Body must be a string',
    'string.min': 'Body must be at least 1 character long',
    'string.max': 'Body cannot exceed 2000 characters',
    'any.required': 'Body is required'
  }),
  url: Joi.string().uri().optional().messages({
    'string.base': 'URL must be a string',
    'string.uri': 'URL must be a valid URI'
  })
});

// Validation for filtering gallery items
exports.filterGalleryItems = Joi.object({
  search: Joi.string().max(100).optional().messages({
    'string.base': 'Search term must be a string',
    'string.max': 'Search term cannot exceed 100 characters'
  })
});

// Validation for filtering news items
exports.filterNewsItems = Joi.object({
  search: Joi.string().max(100).optional().messages({
    'string.base': 'Search term must be a string',
    'string.max': 'Search term cannot exceed 100 characters'
  }),
  isPublished: Joi.boolean().optional().messages({
    'boolean.base': 'isPublished must be a boolean'
  })
});

// Validation for filtering notice items
exports.filterNoticeItems = Joi.object({
  search: Joi.string().max(100).optional().messages({
    'string.base': 'Search term must be a string',
    'string.max': 'Search term cannot exceed 100 characters'
  })
});