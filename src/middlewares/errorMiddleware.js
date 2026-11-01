const { errorResponse } = require('../utils/apiResponse');

/**
 * Centeralized Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for development
  console.error(err);

  // Mongoose Bad ObjectId (Cast Error)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    return errorResponse(res, message, 404);
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered: '${err.keyValue[field]}' for field '${field}'. Please use another value.`;
    return errorResponse(res, message, 400);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return errorResponse(res, 'Validation Error', 400, messages);
  }

  // Multer Upload Errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 'File size too large. Limit is 5MB.', 400);
  }

  // Fallback to internal server error
  return errorResponse(
    res,
    error.message || 'Internal Server Error',
    err.statusCode || 500,
    err.errors || null
  );
};

module.exports = errorHandler;
