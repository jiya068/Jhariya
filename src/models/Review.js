const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    required: [true, 'Review text is required'],
    trim: true
  },
  approved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Static method to calculate avg rating and quantity of reviews
ReviewSchema.statics.calculateAverageRating = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: { product: productId, approved: true }
    },
    {
      $group: {
        _id: '$product',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);

  try {
    if (stats.length > 0) {
      await mongoose.model('Product').findByIdAndUpdate(productId, {
        rating: Math.round(stats[0].avgRating * 10) / 10,
        reviewCount: stats[0].nRating
      });
    } else {
      await mongoose.model('Product').findByIdAndUpdate(productId, {
        rating: 0,
        reviewCount: 0
      });
    }
  } catch (err) {
    console.error('Error updating product rating statistics:', err);
  }
};

// Call calculateAverageRating after save
ReviewSchema.post('save', function () {
  this.constructor.calculateAverageRating(this.product);
});

// Call calculateAverageRating after findOneAndUpdate or findOneAndDelete
ReviewSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) {
    await doc.constructor.calculateAverageRating(doc.product);
  }
});

module.exports = mongoose.model('Review', ReviewSchema);
