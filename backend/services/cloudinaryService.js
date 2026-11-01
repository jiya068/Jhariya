const cloudinary = require('../config/cloudinary');
const fs = require('fs');

/**
 * Uploads a local file to Cloudinary and deletes the local file afterwards
 * @param {string} filePath - Absolute path to local file
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<object>} Upload response
 */
const uploadSingle = async (filePath, folder = 'jhariya/products') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto'
    });
    
    // Delete temp local file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Uploads multiple local files
 * @param {Array<string>} filePaths - Array of local paths
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<Array<object>>} Upload responses
 */
const uploadMultiple = async (filePaths, folder = 'jhariya/products') => {
  const promises = filePaths.map(path => uploadSingle(path, folder));
  return Promise.all(promises);
};

/**
 * Deletes an image from Cloudinary
 * @param {string} identifier - Cloudinary secure URL or public ID
 */
const deleteImage = async (identifier) => {
  try {
    let publicId = identifier;
    
    if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
      const parts = identifier.split('/');
      const filename = parts.pop();
      const publicIdWithExt = filename.split('.')[0];
      
      const uploadIdx = parts.indexOf('upload');
      if (uploadIdx !== -1 && parts.length > uploadIdx + 2) {
        const folderParts = parts.slice(uploadIdx + 2);
        publicId = [...folderParts, publicIdWithExt].join('/');
      } else {
        publicId = publicIdWithExt;
      }
    }
    
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Cloudinary deletion failed: ${error.message}`);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  deleteImage
};
