const SiteSettings = require('../models/SiteSettings');
const { uploadSingle, uploadMultiple, deleteImage } = require('../services/cloudinaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @desc    Get website public configurations
 * @route   GET /settings
 * @access  Public
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getSettings();
    return successResponse(res, settings, 'Site settings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update website configurations
 * @route   PUT /admin/settings
 * @access  Private (Admin)
 */
const updateSettings = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getSettings();
    const {
      brandName,
      aboutUs,
      contactEmail,
      whatsappNumber,
      instagramLink,
      facebookLink,
      returnPolicy,
      shippingPolicy,
      existingHeroBannerImages
    } = req.body;

    // Handle single logo file upload if present
    if (req.files && req.files.logo && req.files.logo.length > 0) {
      // Clean up previous logo from Cloudinary
      if (settings.logoUrl) {
        try {
          await deleteImage(settings.logoUrl);
        } catch (err) {
          console.error(`Failed to delete old logo from Cloudinary: ${settings.logoUrl}`, err);
        }
      }
      const logoUpload = await uploadSingle(req.files.logo[0].path, 'jhariya/brand');
      settings.logoUrl = logoUpload.url;
    }

    // Handle hero banners modification
    let keptBanners = [];
    if (existingHeroBannerImages) {
      keptBanners = Array.isArray(existingHeroBannerImages)
        ? existingHeroBannerImages
        : existingHeroBannerImages.split(',').map(b => b.trim());
    } else {
      keptBanners = settings.heroBannerImages;
    }

    // Delete unused banners from Cloudinary
    const deletedBanners = settings.heroBannerImages.filter(url => !keptBanners.includes(url));
    for (const delUrl of deletedBanners) {
      try {
        await deleteImage(delUrl);
      } catch (err) {
        console.error(`Failed to delete old banner image from Cloudinary: ${delUrl}`, err);
      }
    }

    // Upload new banner images to Cloudinary
    let newBanners = [];
    if (req.files && req.files.heroBannerImages && req.files.heroBannerImages.length > 0) {
      const filePaths = req.files.heroBannerImages.map(f => f.path);
      const uploads = await uploadMultiple(filePaths, 'jhariya/brand');
      newBanners = uploads.map(item => item.url);
    }

    // Update settings details
    settings.brandName = brandName || settings.brandName;
    settings.aboutUs = aboutUs || settings.aboutUs;
    settings.contactEmail = contactEmail || settings.contactEmail;
    settings.whatsappNumber = whatsappNumber || settings.whatsappNumber;
    settings.instagramLink = instagramLink !== undefined ? instagramLink : settings.instagramLink;
    settings.facebookLink = facebookLink !== undefined ? facebookLink : settings.facebookLink;
    settings.returnPolicy = returnPolicy || settings.returnPolicy;
    settings.shippingPolicy = shippingPolicy || settings.shippingPolicy;
    settings.heroBannerImages = [...keptBanners, ...newBanners];

    await settings.save();
    return successResponse(res, settings, 'Site settings updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings
};
