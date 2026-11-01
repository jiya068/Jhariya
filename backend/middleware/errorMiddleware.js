const { errorResponse } = require('../utils/apiResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error(err);

  // Mongoose Bad ObjectId (Cast Error)
  if (err.name === 'CastError') {
    const message = `Resource not found with ID of ${err.value}`;
    return errorResponse(res, message, 404);
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value '${err.keyValue[field]}' for field '${field}'.`;
    return errorResponse(res, message, 400);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return errorResponse(res, 'Database Validation Error', 400, messages);
  }

  // Multer File size limits
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 'Uploaded image size exceeds the maximum limit (10MB).', 400);
  }

  return errorResponse(
    res,
    error.message || 'Internal Server Error',
    err.statusCode || 500,
    err.errors || null
  );
};

module.exports = errorHandler;
