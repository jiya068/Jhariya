const cloudinary = require('../config/cloudinary');
const fs = require('fs');

/**
 * Uploads a local file to Cloudinary and deletes the local file afterwards
 * @param {string} filePath - Absolute path to the local file
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<object>} Cloudinary upload response
 */
const uploadSingle = async (filePath, folder = 'jhariya/products') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto'
    });
    
    // Delete temporary local file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    // Attempt to delete local file if error occurred
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw new Error(`Cloudinary Upload Failed: ${error.message}`);
  }
};

/**
 * Uploads multiple local files to Cloudinary
 * @param {Array<string>} filePaths - Array of local file paths
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Array<object>>} Array of Cloudinary upload responses
 */
const uploadMultiple = async (filePaths, folder = 'jhariya/products') => {
  const uploadPromises = filePaths.map(filePath => uploadSingle(filePath, folder));
  return Promise.all(uploadPromises);
};

/**
 * Deletes an image from Cloudinary using its secure URL or public ID
 * @param {string} identifier - Cloudinary secure URL or public ID
 * @returns {Promise<object>} Cloudinary destroy response
 */
const deleteImage = async (identifier) => {
  try {
    let publicId = identifier;
    
    // If it's a URL, extract public ID
    if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
      const parts = identifier.split('/');
      const filename = parts.pop(); // e.g. "image.jpg"
      const publicIdWithExt = filename.split('.')[0];
      
      // If there are folder parts (e.g. ".../upload/v1234/folder/subfolder/image.jpg")
      const uploadIdx = parts.indexOf('upload');
      if (uploadIdx !== -1 && parts.length > uploadIdx + 2) {
        // Folders are between the version tag (e.g., v16239483) and the filename
        const folderParts = parts.slice(uploadIdx + 2); // slice after version tag
        publicId = [...folderParts, publicIdWithExt].join('/');
      } else {
        publicId = publicIdWithExt;
      }
    }
    
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Cloudinary Deletion Failed: ${error.message}`);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  deleteImage
};
