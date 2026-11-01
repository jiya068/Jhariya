const User = require('../models/User');
const Product = require('../models/Product');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @desc    Add product to cart or increment quantity
 * @route   POST /cart/add
 * @access  Private (Customer)
 */
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, size } = req.body;

    if (!productId || !size) {
      return errorResponse(res, 'Product ID and Size are required', 400);
    }

    // Verify product exists and is in stock
    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    if (!product.sizes.includes(size)) {
      return errorResponse(res, `Selected size '${size}' is not available for this product`, 400);
    }

    // Check stock availability
    if (product.stock < quantity) {
      return errorResponse(res, `Only ${product.stock} items left in stock`, 400);
    }

    // Get user from token verification middleware
    const user = await User.findById(req.user._id);

    // Check if product with same size already in cart
    const cartItemIndex = user.cart.findIndex(
      item => item.product.toString() === productId && item.size === size
    );

    if (cartItemIndex > -1) {
      // Check merged quantity does not exceed stock
      const newQty = user.cart[cartItemIndex].quantity + parseInt(quantity);
      if (product.stock < newQty) {
        return errorResponse(res, `Cannot add more. Combined cart quantity exceeds available stock (${product.stock}).`, 400);
      }
      user.cart[cartItemIndex].quantity = newQty;
    } else {
      user.cart.push({
        product: productId,
        quantity: parseInt(quantity),
        size
      });
    }

    await user.save();
    
    // Fetch updated populated cart
    const updatedUser = await User.findById(req.user._id).populate('cart.product', 'title price salePrice images stock');
    
    return successResponse(res, updatedUser.cart, 'Item added to cart successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's cart items
 * @route   GET /cart
 * @access  Private (Customer)
 */
const getCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('cart.product', 'title price salePrice images stock sizes category');
      
    return successResponse(res, user.cart, 'Cart retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update quantity of a cart item
 * @route   PUT /cart/:itemId
 * @access  Private (Customer)
 */
const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;

    if (!quantity || quantity < 1) {
      return errorResponse(res, 'Quantity must be at least 1', 400);
    }

    const user = await User.findById(req.user._id);
    const cartItem = user.cart.id(itemId);

    if (!cartItem) {
      return errorResponse(res, 'Cart item not found', 404);
    }

    // Verify stock
    const product = await Product.findById(cartItem.product);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    if (product.stock < quantity) {
      return errorResponse(res, `Only ${product.stock} items left in stock`, 400);
    }

    cartItem.quantity = parseInt(quantity);
    await user.save();

    const updatedUser = await User.findById(req.user._id).populate('cart.product', 'title price salePrice images stock');
    return successResponse(res, updatedUser.cart, 'Cart item updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove an item from cart
 * @route   DELETE /cart/:itemId
 * @access  Private (Customer)
 */
const removeCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const user = await User.findById(req.user._id);

    // Filter out item
    user.cart = user.cart.filter(item => item._id.toString() !== itemId);
    await user.save();

    const updatedUser = await User.findById(req.user._id).populate('cart.product', 'title price salePrice images stock');
    return successResponse(res, updatedUser.cart, 'Item removed from cart');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem
};
