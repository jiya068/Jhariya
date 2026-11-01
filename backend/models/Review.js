const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5,
    default: 5
  },
  quote: {
    type: String,
    required: [true, 'Review message is required'],
    trim: true
  },
  photo: {
    type: String,
    default: null
  },
  verified: {
    type: Boolean,
    default: true
  },
  date: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Review', ReviewSchema);
