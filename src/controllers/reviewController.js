const Review = require('../models/Review');
const Product = require('../models/Product');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @desc    Add review for a product (defaults to approved: false for admin moderation)
 * @route   POST /review/add
 * @access  Private (Customer)
 */
const addReview = async (req, res, next) => {
  try {
    const { productId, rating, reviewText } = req.body;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', 400);
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ user: req.user._id, product: productId });
    if (existingReview) {
      // Allow them to update their review instead of throwing error, or update the rating
      existingReview.rating = rating;
      existingReview.reviewText = reviewText;
      existingReview.approved = false; // reset moderation status on edit
      await existingReview.save();
      return successResponse(res, existingReview, 'Review updated successfully and pending admin approval');
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating,
      reviewText,
      approved: false // requires admin approval
    });

    return successResponse(res, review, 'Review submitted successfully. It will be visible once approved.', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all reviews for admin moderation
 * @route   GET /admin/reviews
 * @access  Private (Admin)
 */
const getAdminReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'fullName email')
      .populate('product', 'title slug images')
      .sort({ createdAt: -1 });

    return successResponse(res, reviews, `Fetched ${reviews.length} reviews`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve/moderate a review
 * @route   PUT /admin/review-approve/:id
 * @access  Private (Admin)
 */
const approveReview = async (req, res, next) => {
  try {
    const { approved = true } = req.body;
    const reviewId = req.params.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return errorResponse(res, 'Review not found', 404);
    }

    review.approved = approved;
    await review.save(); // triggers pre/post save hooks to update product averages!

    return successResponse(res, review, `Review approved status set to ${approved}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a review
 * @route   DELETE /admin/review/:id
 * @access  Private (Admin)
 */
const deleteReview = async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const review = await Review.findById(reviewId);
    if (!review) {
      return errorResponse(res, 'Review not found', 404);
    }

    await review.deleteOne(); // triggers post findOneAnd/save hooks

    return successResponse(res, null, 'Review deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addReview,
  getAdminReviews,
  approveReview,
  deleteReview
};
