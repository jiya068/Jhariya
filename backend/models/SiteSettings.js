const mongoose = require('mongoose');

const SiteSettingsSchema = new mongoose.Schema({
  aboutUs: {
    type: String,
    required: true,
    default: 'Welcome to Jhariya, your premium fashion destination.'
  },
  logo: {
    type: String,
    default: ''
  },
  contactEmail: {
    type: String,
    required: true,
    default: 'info@jhariya.com'
  },
  contactPhone: {
    type: String,
    required: true,
    default: '+919999999999'
  },
  instagram: {
    type: String,
    default: 'https://instagram.com/jhariya'
  },
  facebook: {
    type: String,
    default: 'https://facebook.com/jhariya'
  },
  shippingPolicy: {
    type: String,
    required: true,
    default: 'Free shipping on orders above ₹2,000. Dispatch within 24-48 hours.'
  },
  returnPolicy: {
    type: String,
    required: true,
    default: 'We offer a 10-day exchange and return policy on unworn designs.'
  },
  heroBannerImages: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

SiteSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);
