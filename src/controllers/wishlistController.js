const User = require('../models/User');
const Product = require('../models/Product');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @desc    Toggle a product in wishlist (Add if not present, remove if present)
 * @route   POST /wishlist/add
 * @access  Private (Customer)
 */
const toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', 400);
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    const user = await User.findById(req.user._id);

    const isWishlisted = user.wishlist.includes(productId);
    if (isWishlisted) {
      // Remove from wishlist
      user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
      await user.save();
      return successResponse(res, user.wishlist, 'Removed from wishlist successfully');
    } else {
      // Add to wishlist
      user.wishlist.push(productId);
      await user.save();
      return successResponse(res, user.wishlist, 'Added to wishlist successfully');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's wishlist
 * @route   GET /wishlist
 * @access  Private (Customer)
 */
const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist', 'title price salePrice images category stock');
    return successResponse(res, user.wishlist, 'Wishlist retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  toggleWishlist,
  getWishlist
};
