const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Sign JWT token helper
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @desc    Register a new customer user
 * @route   POST /auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { fullName, email, password, phone } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return errorResponse(res, 'A user with this email already exists', 400);
    }

    // Create user (role defaults to 'customer')
    const user = await User.create({
      fullName,
      email,
      password,
      phone,
      role: 'customer'
    });

    // Generate JWT token
    const token = signToken(user._id);

    // Format response
    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt
    };

    return successResponse(res, { user: userData, token }, 'User registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login customer
 * @route   POST /auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Fetch user and include password for comparison
    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Ensure they are customer
    if (user.role !== 'customer') {
      return errorResponse(res, 'This route is for customers. Admins should login via /admin/login.', 403);
    }

    // Generate JWT token
    const token = signToken(user._id);

    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      addresses: user.addresses,
      wishlist: user.wishlist,
      cart: user.cart,
      createdAt: user.createdAt
    };

    return successResponse(res, { user: userData, token }, 'Logged in successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login
};
