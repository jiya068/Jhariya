const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

// Check validations results helper
const validateResults = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 'Validation failed', 400, errors.array());
  }
  next();
};

const registerValidator = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').trim().isEmail().withMessage('Provide a valid email address').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  validateResults
];

const loginValidator = [
  body('email').trim().isEmail().withMessage('Provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validateResults
];

const productValidator = [
  body('title').trim().notEmpty().withMessage('Product title is required'),
  body('description').trim().notEmpty().withMessage('Product description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('salePrice')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Sale price must be a positive number'),
  body('fabric').trim().notEmpty().withMessage('Fabric detail is required'),
  body('style').trim().notEmpty().withMessage('Style detail is required'),
  body('sizes')
    .custom((val) => {
      // Support array of strings or comma-separated string
      if (Array.isArray(val) && val.length > 0) return true;
      if (typeof val === 'string' && val.trim().length > 0) return true;
      throw new Error('Sizes must be an array or a non-empty comma-separated string');
    }),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be an integer (0 or more)'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  validateResults
];

const reviewValidator = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer between 1 and 5'),
  body('reviewText').trim().notEmpty().withMessage('Review text cannot be empty'),
  validateResults
];

const orderValidator = [
  body('products').isArray({ min: 1 }).withMessage('Order products must be a non-empty array'),
  body('products.*.productId').isMongoId().withMessage('Product ID in order is invalid'),
  body('products.*.quantity').isInt({ min: 1 }).withMessage('Product quantity must be at least 1'),
  body('products.*.size').notEmpty().withMessage('Product size is required'),
  body('shippingAddress').isObject().withMessage('Shipping address is required'),
  body('shippingAddress.street').notEmpty().withMessage('Street is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('shippingAddress.state').notEmpty().withMessage('State is required'),
  body('shippingAddress.postalCode').notEmpty().withMessage('Postal code is required'),
  validateResults
];

module.exports = {
  registerValidator,
  loginValidator,
  productValidator,
  reviewValidator,
  orderValidator
};
