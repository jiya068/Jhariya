const xss = require('xss');

/**
 * Recursively sanitize fields inside an object to prevent XSS payloads
 * @param {any} value - Value to check and clean
 * @returns {any} Sanitized value
 */
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const sanitizedObj = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitizedObj[key] = sanitizeValue(value[key]);
      }
    }
    return sanitizedObj;
  }
  return value;
};

/**
 * XSS Clean middleware
 */
const xssClean = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
};

module.exports = xssClean;
