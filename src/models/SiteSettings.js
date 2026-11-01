const mongoose = require('mongoose');

const SiteSettingsSchema = new mongoose.Schema({
  brandName: {
    type: String,
    required: true,
    default: 'Jhariya'
  },
  aboutUs: {
    type: String,
    required: true,
    default: 'Welcome to Jhariya, your premium fashion destination.'
  },
  contactEmail: {
    type: String,
    required: true,
    default: 'info@jhariya.com'
  },
  whatsappNumber: {
    type: String,
    required: true,
    default: '+919999999999'
  },
  instagramLink: {
    type: String,
    default: 'https://instagram.com/jhariya'
  },
  facebookLink: {
    type: String,
    default: 'https://facebook.com/jhariya'
  },
  returnPolicy: {
    type: String,
    required: true,
    default: 'We offer a 7-day return policy on all unworn items.'
  },
  shippingPolicy: {
    type: String,
    required: true,
    default: 'Free shipping on orders above ₹999. Standard shipping takes 3-5 business days.'
  },
  logoUrl: {
    type: String,
    default: ''
  },
  heroBannerImages: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Static helper to fetch or create the default configuration document
SiteSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);
