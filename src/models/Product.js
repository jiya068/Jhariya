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
    required: [true, 'Original price is required'],
    min: [0, 'Price must be positive']
  },
  salePrice: {
    type: Number,
    min: [0, 'Sale price must be positive'],
    default: null
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
  sizes: {
    type: [String],
    required: [true, 'At least one product size is required'],
    validate: [v => Array.isArray(v) && v.length > 0, 'Sizes array cannot be empty']
  },
  stock: {
    type: Number,
    required: [true, 'Product stock is required'],
    min: [0, 'Stock cannot be less than 0'],
    default: 0
  },
  images: {
    type: [String],
    required: [true, 'At least one image is required'],
    validate: [v => Array.isArray(v) && v.length > 0, 'Product images cannot be empty']
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNewArrival: {
    type: Boolean,
    default: false
  },
  isBestSeller: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
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
