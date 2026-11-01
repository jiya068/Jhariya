const Product = require('../models/Product');
const Review = require('../models/Review');
const { uploadMultiple, deleteImage } = require('../services/cloudinaryService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @desc    Get all products with query filters, pagination, and sorting
 * @route   GET /products
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      isFeatured,
      isNewArrival,
      isBestSeller,
      sort,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    // Filters
    if (category) {
      query.category = category;
    }
    if (isFeatured) {
      query.isFeatured = isFeatured === 'true';
    }
    if (isNewArrival) {
      query.isNewArrival = isNewArrival === 'true';
    }
    if (isBestSeller) {
      query.isBestSeller = isBestSeller === 'true';
    }

    // Search query on title/description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    let sortBy = { createdAt: -1 };
    if (sort) {
      if (sort === 'priceAsc') {
        sortBy = { price: 1 };
      } else if (sort === 'priceDesc') {
        sortBy = { price: -1 };
      } else if (sort === 'rating') {
        sortBy = { rating: -1 };
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
 * @desc    Get single product by slug and its approved reviews
 * @route   GET /product/:slug
 * @access  Public
 */
const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Get approved reviews and populate user details
    const reviews = await Review.find({ product: product._id, approved: true })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    return successResponse(res, { product, reviews }, 'Product details fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a product
 * @route   POST /admin/create-product
 * @access  Private (Admin)
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      title,
      description,
      price,
      salePrice,
      fabric,
      style,
      sizes,
      stock,
      isFeatured,
      isNewArrival,
      isBestSeller,
      category
    } = req.body;

    // Handle uploaded files to Cloudinary
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 'Product images are required (at least one image)', 400);
    }

    const filePaths = req.files.map(file => file.path);
    const uploads = await uploadMultiple(filePaths);
    const images = uploads.map(item => item.url);

    // Format sizes (could come as comma-separated string)
    let finalSizes = sizes;
    if (typeof sizes === 'string') {
      finalSizes = sizes.split(',').map(s => s.trim());
    }

    const product = await Product.create({
      title,
      description,
      price,
      salePrice: salePrice || null,
      fabric,
      style,
      sizes: finalSizes,
      stock,
      images,
      isFeatured: isFeatured === 'true',
      isNewArrival: isNewArrival === 'true',
      isBestSeller: isBestSeller === 'true',
      category
    });

    return successResponse(res, product, 'Product created successfully', 201);
  } catch (error) {
    // Cleanup files if multer downloaded them but creation crashed before Cloudinary service removed them
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    next(error);
  }
};

/**
 * @desc    Update a product
 * @route   PUT /admin/update-product/:id
 * @access  Private (Admin)
 */
const updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    const {
      title,
      description,
      price,
      salePrice,
      fabric,
      style,
      sizes,
      stock,
      isFeatured,
      isNewArrival,
      isBestSeller,
      category,
      existingImages // Array or comma-separated string of URLs that we want to keep
    } = req.body;

    // Parse existing images
    let keptImages = [];
    if (existingImages) {
      keptImages = Array.isArray(existingImages)
        ? existingImages
        : existingImages.split(',').map(img => img.trim());
    } else {
      // If not sent, default to keeping current images
      keptImages = product.images;
    }

    // Determine deleted images and clean them up from Cloudinary
    const deletedImages = product.images.filter(imgUrl => !keptImages.includes(imgUrl));
    for (const deletedUrl of deletedImages) {
      try {
        await deleteImage(deletedUrl);
      } catch (err) {
        console.error(`Failed to delete old image from Cloudinary: ${deletedUrl}`, err);
      }
    }

    // Upload new images to Cloudinary
    let newImages = [];
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(file => file.path);
      const uploads = await uploadMultiple(filePaths);
      newImages = uploads.map(item => item.url);
    }

    const mergedImages = [...keptImages, ...newImages];
    if (mergedImages.length === 0) {
      return errorResponse(res, 'Product must have at least one image', 400);
    }

    // Update details
    product.title = title || product.title;
    product.description = description || product.description;
    product.price = price !== undefined ? price : product.price;
    product.salePrice = salePrice !== undefined ? (salePrice === '' || salePrice === 'null' ? null : salePrice) : product.salePrice;
    product.fabric = fabric || product.fabric;
    product.style = style || product.style;
    product.stock = stock !== undefined ? stock : product.stock;
    product.category = category || product.category;
    product.images = mergedImages;

    if (sizes) {
      product.sizes = typeof sizes === 'string' ? sizes.split(',').map(s => s.trim()) : sizes;
    }
    if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true';
    if (isNewArrival !== undefined) product.isNewArrival = isNewArrival === 'true';
    if (isBestSeller !== undefined) product.isBestSeller = isBestSeller === 'true';

    await product.save();
    return successResponse(res, product, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a product and its images from Cloudinary
 * @route   DELETE /admin/delete-product/:id
 * @access  Private (Admin)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Delete images from Cloudinary
    for (const imgUrl of product.images) {
      try {
        await deleteImage(imgUrl);
      } catch (err) {
        console.error(`Failed to delete product image from Cloudinary: ${imgUrl}`, err);
      }
    }

    // Delete reviews associated with product
    await Review.deleteMany({ product: product._id });

    // Remove product
    await product.deleteOne();

    return successResponse(res, null, 'Product and associated resources deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct
};
