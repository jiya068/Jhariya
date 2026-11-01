const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { uploadMultiple, deleteImage } = require('../services/cloudinaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { saveProductsToFile } = require('../services/persistenceService');

/**
 * @desc    Get all products (Public storefront with filters, pagination, search, sorting)
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      featured,
      newArrival,
      bestseller,
      sort,
      page = 1,
      limit = 100 // High default limit so frontend can manage client-side paging or load catalog
    } = req.query;

    const query = {};

    if (category) {
      query.style = category; // Map category filter to style or category field
    }
    if (featured) {
      query.featured = featured === 'true';
    }
    if (newArrival) {
      query.newArrival = newArrival === 'true';
    }
    if (bestseller) {
      query.bestseller = bestseller === 'true';
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { fabric: { $regex: search, $options: 'i' } },
        { style: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let sortBy = { createdAt: -1 };
    if (sort) {
      if (sort === 'price-low') {
        sortBy = { price: 1 };
      } else if (sort === 'price-high') {
        sortBy = { price: -1 };
      } else if (sort === 'rating') {
        sortBy = { rating: -1 };
      } else if (sort === 'newest') {
        sortBy = { newArrival: -1, createdAt: -1 };
      }
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));

    return successResponse(res, {
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    }, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product details (handles slug or ID lookups)
 * @route   GET /api/products/:identifier
 * @access  Public
 */
const getProductDetails = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let product;

    // Check if identifier is valid MongoDB ObjectId, else find by slug
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(identifier);
    } else {
      product = await Product.findOne({ slug: identifier });
    }

    if (!product) {
      return errorResponse(res, 'Product not found.', 404);
    }

    const reviews = await Review.find({ productId: product._id })
      .populate('userId', 'fullName')
      .sort({ createdAt: -1 });

    return successResponse(res, { product, reviews }, 'Product details fetched successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin products list
 * @route   GET /api/admin/products
 * @access  Private (Admin)
 */
const getAdminProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return successResponse(res, products, `Fetched ${products.length} products for catalog management.`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a product
 * @route   POST /api/admin/product
 * @access  Private (Admin)
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      title,
      description,
      price,
      fabric,
      style,
      color,
      embroidery,
      sleeve,
      neck,
      fit,
      washCare,
      length,
      stock,
      sizes,
      featured,
      newArrival,
      bestseller
    } = req.body;

    let images = [];

    // Check if images are uploaded
    if (req.files && req.files.length > 0) {
      const paths = req.files.map(f => f.path);
      const uploads = await uploadMultiple(paths);
      images = uploads.map(item => item.url);
    } else if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images = req.body.images;
      } else if (typeof req.body.images === 'string') {
        try {
          images = JSON.parse(req.body.images);
        } catch (e) {
          images = req.body.images.split('\n').map(img => img.trim()).filter(Boolean);
        }
      }
    } else if (req.body.image) {
      images = [req.body.image];
    }

    if (!images || images.length === 0) {
      images = ['assets/logo.png'];
    }

    // Format sizes
    let parsedSizes = sizes;
    if (typeof sizes === 'string') {
      parsedSizes = sizes.split(',').map(s => s.trim());
    }

    const product = await Product.create({
      title,
      description,
      price: parseFloat(price),
      fabric,
      style,
      color: color || 'Not specified',
      embroidery: embroidery || 'Not specified',
      sleeve: sleeve || 'Not specified',
      neck: neck || 'Not specified',
      fit: fit || 'Not specified',
      washCare: washCare || 'Not specified',
      length: length || 'Not specified',
      stock: parseInt(stock) || 0,
      images,
      sizes: parsedSizes || ['S', 'M', 'L', 'XL', 'XXL'],
      featured: featured === 'true' || featured === true,
      newArrival: newArrival === 'true' || newArrival === true,
      bestseller: bestseller === 'true' || bestseller === true
    });

    await saveProductsToFile();

    return successResponse(res, product, 'Product added to catalog successfully.', 201);
  } catch (error) {
    if (req.files) {
      req.files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    next(error);
  }
};

/**
 * @desc    Update a product
 * @route   PUT /api/admin/product/:id
 * @access  Private (Admin)
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 'Product not found.', 404);
    }

    const {
      title,
      description,
      price,
      fabric,
      style,
      color,
      embroidery,
      sleeve,
      neck,
      fit,
      washCare,
      length,
      stock,
      sizes,
      featured,
      newArrival,
      bestseller
    } = req.body;

    // ----------------------------------------------------------------
    // Resolve final images array — priority order:
    //   1. New multipart file uploads (via multer)
    //   2. req.body.images array (URLs sent as JSON from admin panel)
    //   3. req.body.existingImages (legacy field name)
    //   4. req.body.image single URL fallback
    //   5. Keep existing images from DB unchanged
    // ----------------------------------------------------------------
    let finalImages = product.images; // safe default

    if (req.files && req.files.length > 0) {
      // Multipart upload path — save locally, return /uploads/ URLs
      const newFileUrls = req.files.map(f => `/uploads/${f.filename || path.basename(f.path)}`);
      // Merge with any kept images from body
      const kept = req.body.existingImages
        ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages])
        : (req.body.images ? (Array.isArray(req.body.images) ? req.body.images : []) : product.images);
      finalImages = [...kept, ...newFileUrls];
    } else if (req.body.images) {
      // JSON body with images array — primary path used by admin panel
      if (Array.isArray(req.body.images)) {
        finalImages = req.body.images.filter(Boolean);
      } else if (typeof req.body.images === 'string') {
        try {
          finalImages = JSON.parse(req.body.images).filter(Boolean);
        } catch {
          finalImages = req.body.images.split('\n').map(s => s.trim()).filter(Boolean);
        }
      }
    } else if (req.body.existingImages) {
      finalImages = Array.isArray(req.body.existingImages)
        ? req.body.existingImages
        : [req.body.existingImages];
    } else if (req.body.image) {
      finalImages = [req.body.image];
    }

    if (!finalImages || finalImages.length === 0) {
      finalImages = product.images; // never remove all images
    }

    // Build update payload — only include fields that were sent
    const updatePayload = {
      images: finalImages
    };
    if (title !== undefined)       updatePayload.title = title;
    if (description !== undefined) updatePayload.description = description;
    if (price !== undefined)       updatePayload.price = parseFloat(price);
    if (fabric !== undefined)      updatePayload.fabric = fabric;
    if (style !== undefined)       updatePayload.style = style;
    if (color !== undefined)       updatePayload.color = color;
    if (embroidery !== undefined)  updatePayload.embroidery = embroidery;
    if (sleeve !== undefined)      updatePayload.sleeve = sleeve;
    if (neck !== undefined)        updatePayload.neck = neck;
    if (fit !== undefined)         updatePayload.fit = fit;
    if (washCare !== undefined)    updatePayload.washCare = washCare;
    if (length !== undefined)      updatePayload.length = length;
    if (stock !== undefined)       updatePayload.stock = parseInt(stock);
    if (sizes !== undefined) {
      updatePayload.sizes = typeof sizes === 'string'
        ? sizes.split(',').map(s => s.trim()).filter(Boolean)
        : sizes;
    }
    if (featured !== undefined)   updatePayload.featured = featured === 'true' || featured === true;
    if (newArrival !== undefined)  updatePayload.newArrival = newArrival === 'true' || newArrival === true;
    if (bestseller !== undefined)  updatePayload.bestseller = bestseller === 'true' || bestseller === true;

    // Use findByIdAndUpdate to bypass Mongoose __v optimistic concurrency lock
    // (avoids "No matching document found for id ... version N modifiedPaths images" VersionError)
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return errorResponse(res, 'Product not found after update.', 404);
    }

    await saveProductsToFile();

    return successResponse(res, updatedProduct, 'Product modified successfully.');
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Delete a product
 * @route   DELETE /api/admin/product/:id
 * @access  Private (Admin)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return errorResponse(res, 'Product not found.', 404);
    }

    // Cloudinary assets deletion
    for (const url of product.images) {
      try {
        await deleteImage(url);
      } catch (err) {
        console.error('Error deleting image:', url);
      }
    }

    // Clean up corresponding reviews
    await Review.deleteMany({ productId: product._id });
    await product.deleteOne();

    await saveProductsToFile();

    return successResponse(res, null, 'Product and associated reviews deleted.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductDetails,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImages
};

/**
 * @desc    Upload product images locally and return server URLs
 * @route   POST /api/admin/upload-images
 * @access  Private (Admin)
 */
async function uploadImages(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 'No image files received.', 400);
    }

    // Return the public URL paths for each uploaded file
    const urls = req.files.map(f => {
      // Normalize to forward slashes and extract relative path from uploads dir
      const filename = f.filename || path.basename(f.path);
      return `/uploads/${filename}`;
    });

    return successResponse(res, urls, `${urls.length} image(s) uploaded successfully.`);
  } catch (error) {
    next(error);
  }
}

