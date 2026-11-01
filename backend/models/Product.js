const mongoose = require('mongoose');
const slugify = require('slugify');

const ProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price must be positive']
  },
  fabric: {
    type: String,
    required: [true, 'Fabric description is required'],
    trim: true
  },
  style: {
    type: String,
    required: [true, 'Style details are required'],
    trim: true
  },
  color: {
    type: String,
    default: 'Not specified',
    trim: true
  },
  embroidery: {
    type: String,
    default: 'Not specified',
    trim: true
  },
  sleeve: {
    type: String,
    default: 'Not specified',
    trim: true
  },
  neck: {
    type: String,
    default: 'Not specified',
    trim: true
  },
  fit: {
    type: String,
    default: 'Not specified',
    trim: true
  },
  washCare: {
    type: String,
    default: 'Not specified',
    trim: true
  },
  length: {
    type: String,
    default: 'Not specified',
    trim: true
  },
  stock: {
    type: Number,
    required: [true, 'Product stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  images: {
    type: [String],
    required: [true, 'At least one image is required'],
    validate: [v => Array.isArray(v) && v.length > 0, 'Product images cannot be empty']
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  sizes: {
    type: [String],
    required: [true, 'At least one size is required'],
    validate: [v => Array.isArray(v) && v.length > 0, 'Sizes array cannot be empty']
  },
  featured: {
    type: Boolean,
    default: false
  },
  newArrival: {
    type: Boolean,
    default: false
  },
  bestseller: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-generate slug from title
ProductSchema.pre('validate', function (next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Product', ProductSchema);
