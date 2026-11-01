const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { saveUsersToFile } = require('../services/persistenceService');

// Sign JWT helper
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @desc    Register a new customer/user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { fullName, email, password, phone, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return errorResponse(res, 'Email is already registered.', 400);
    }

    const user = await User.create({
      fullName,
      email,
      password,
      phone,
      role: role === 'admin' ? 'admin' : 'customer'
    });

    await saveUsersToFile();

    const token = signToken(user._id);

    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt
    };

    return successResponse(res, { user: userData, token }, 'Registration successful.', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log in a user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 'Invalid credentials.', 401);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid credentials.', 401);
    }

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

    return successResponse(res, { user: userData, token }, 'Login successful.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private (Authenticated)
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return errorResponse(res, 'User not found.', 404);
    }
    return successResponse(res, user, 'Profile fetched successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile
};
