const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Middleware to verify JWT Token
 */
const verifyToken = async (req, res, next) => {
  let token;

  // Check Authorization Header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, 'Not authorized to access this route. Token is missing.', 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database, excluding password
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return errorResponse(res, 'User not found with this token.', 404);
    }
    
    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, 'Not authorized. Token is invalid or expired.', 401);
  }
};

/**
 * Middleware to restrict route to Admin only
 */
const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return errorResponse(res, 'Access denied. Administrator privileges required.', 403);
  }
};

module.exports = {
  verifyToken,
  verifyAdmin
};
