/**
 * Standard API Response helpers
 */

/**
 * Send success JSON response
 * @param {object} res - Express response object
 * @param {any} data - Payload data
 * @param {string} message - Human-readable success message
 * @param {number} statusCode - HTTP status code (default 200)
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send error JSON response
 * @param {object} res - Express response object
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {any} errors - Detailed error logs or arrays (like validation fields)
 */
const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

module.exports = {
  successResponse,
  errorResponse
};
