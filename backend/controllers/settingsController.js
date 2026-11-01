const SiteSettings = require('../models/SiteSettings');
const { uploadSingle, uploadMultiple, deleteImage } = require('../services/cloudinaryService');
const { successResponse } = require('../utils/apiResponse');
const { saveSettingsToFile } = require('../services/persistenceService');

/**
 * @desc    Get boutique info
 * @route   GET /api/settings
 * @access  Public
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getSettings();
    return successResponse(res, settings, 'Boutique details fetched successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update boutique configurations
 * @route   PUT /api/admin/settings
 * @access  Private (Admin)
 */
const updateSettings = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getSettings();
    const {
      aboutUs,
      contactEmail,
      contactPhone,
      instagram,
      facebook,
      shippingPolicy,
      returnPolicy,
      existingHeroBannerImages
    } = req.body;

    // Logo upload
    if (req.files && req.files.logo && req.files.logo.length > 0) {
      if (settings.logo) {
        try { await deleteImage(settings.logo); } catch (e) {}
      }
      const logoUpload = await uploadSingle(req.files.logo[0].path, 'jhariya/brand');
      settings.logo = logoUpload.url;
    }

    // Hero banners RETENTION/DELETION
    let keptBanners = [];
    if (existingHeroBannerImages) {
      keptBanners = Array.isArray(existingHeroBannerImages)
        ? existingHeroBannerImages
        : [existingHeroBannerImages];
    } else {
      keptBanners = settings.heroBannerImages;
    }

    const deletedBanners = settings.heroBannerImages.filter(url => !keptBanners.includes(url));
    for (const delUrl of deletedBanners) {
      try { await deleteImage(delUrl); } catch (e) {}
    }

    // Upload new banners
    let newBanners = [];
    if (req.files && req.files.heroBannerImages && req.files.heroBannerImages.length > 0) {
      const paths = req.files.heroBannerImages.map(f => f.path);
      const uploads = await uploadMultiple(paths, 'jhariya/brand');
      newBanners = uploads.map(item => item.url);
    }

    settings.aboutUs = aboutUs || settings.aboutUs;
    settings.contactEmail = contactEmail || settings.contactEmail;
    settings.contactPhone = contactPhone || settings.contactPhone;
    settings.instagram = instagram !== undefined ? instagram : settings.instagram;
    settings.facebook = facebook !== undefined ? facebook : settings.facebook;
    settings.shippingPolicy = shippingPolicy || settings.shippingPolicy;
    settings.returnPolicy = returnPolicy || settings.returnPolicy;
    settings.heroBannerImages = [...keptBanners, ...newBanners];

    await settings.save();
    await saveSettingsToFile();

    return successResponse(res, settings, 'Boutique details modified.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings
};
