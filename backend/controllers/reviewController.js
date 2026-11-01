const path = require('path');
const Review = require('../models/Review');
const { saveReviewsToFile, loadReviewsFromFile } = require('../services/persistenceService');

/**
 * GET /api/reviews
 * Fetch all customer submitted reviews from MongoDB (fallback to file if offline)
 */
exports.getReviews = async (req, res, next) => {
  try {
    let reviews = await Review.find().sort({ createdAt: -1 }).lean();
    if (!reviews || reviews.length === 0) {
      const fileReviews = await loadReviewsFromFile();
      if (fileReviews && fileReviews.length > 0) {
        return res.status(200).json({ success: true, data: fileReviews });
      }
    }
    return res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews
 * Submit a customer review with optional photo
 */
exports.addReview = async (req, res, next) => {
  try {
    const { name, rating, quote, photo } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }
    if (!quote || !quote.trim()) {
      return res.status(400).json({ success: false, message: 'Review message is required.' });
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const d = new Date();
    const dateStr = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    const newReview = await Review.create({
      name: name.trim(),
      rating: parseInt(rating) || 5,
      quote: quote.trim(),
      photo: photo || null,
      verified: true,
      date: dateStr
    });

    const fileReviews = await loadReviewsFromFile() || [];
    fileReviews.unshift(newReview.toObject());
    await saveReviewsToFile(fileReviews);

    return res.status(201).json({
      success: true,
      data: newReview,
      message: 'Thank you for your review!'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews/upload-photo
 * Upload a customer photo for review
 */
exports.uploadReviewPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded.' });
    }
    const filename = req.file.filename || path.basename(req.file.path);
    const photoUrl = `/uploads/${filename}`;
    return res.status(200).json({
      success: true,
      data: photoUrl
    });
  } catch (err) {
    next(err);
  }
};
