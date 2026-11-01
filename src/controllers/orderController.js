const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { createRazorpayOrder, verifyPaymentSignature, getRazorpayKeyId } = require('../services/razorpayService');
const { sendOrderConfirmationEmail } = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @desc    Create an order and initiate Razorpay checkout
 * @route   POST /order/create
 * @access  Private (Customer)
 */
const createOrder = async (req, res, next) => {
  try {
    const { products: checkoutItems, shippingAddress } = req.body;

    if (!checkoutItems || checkoutItems.length === 0) {
      return errorResponse(res, 'Order products cannot be empty', 400);
    }

    let subtotal = 0;
    const orderItems = [];

    // Verify products and build order items list
    for (const item of checkoutItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return errorResponse(res, `Product not found: ${item.productId}`, 404);
      }

      // Check stock availability
      if (product.stock < item.quantity) {
        return errorResponse(res, `Insufficient stock for product '${product.title}'. Only ${product.stock} units available.`, 400);
      }

      // Check size availability
      if (!product.sizes.includes(item.size)) {
        return errorResponse(res, `Size '${item.size}' is not available for product '${product.title}'`, 400);
      }

      // Compute price (use salePrice if available)
      const activePrice = product.salePrice !== null && product.salePrice !== undefined 
        ? product.salePrice 
        : product.price;

      subtotal += activePrice * item.quantity;
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        size: item.size,
        price: activePrice
      });
    }

    // Shipping fee configuration: Free above/equal to 2000, else 99
    const shippingCharge = subtotal >= 2000 ? 0 : 99;
    const totalAmount = subtotal + shippingCharge;

    // Create Order document in DB (payment Status pending)
    const order = new Order({
      user: req.user._id,
      products: orderItems,
      subtotal,
      shippingCharge,
      totalAmount,
      shippingAddress,
      paymentStatus: 'pending',
      orderStatus: 'pending'
    });

    const rzpKey = getRazorpayKeyId();
    const isPlaceholder = !rzpKey || rzpKey.includes('placeholder');

    let rzpOrder = null;
    if (!isPlaceholder) {
      try {
        rzpOrder = await createRazorpayOrder(totalAmount, order._id.toString());
        order.razorpayOrderId = rzpOrder.id;
      } catch (rzpErr) {
        console.error('Razorpay order creation error:', rzpErr.message);
        return errorResponse(res, `Razorpay Order creation failed: ${rzpErr.message}`, 400);
      }
    } else {
      console.warn('Placeholder Razorpay key detected. Generating mock Razorpay Order ID.');
      order.razorpayOrderId = `rzp_order_mock_${Date.now()}`;
    }

    await order.save();

    return successResponse(res, {
      orderId: order._id,
      razorpayOrderId: order.razorpayOrderId,
      key: rzpKey || 'rzp_test_placeholder_key',
      amount: Math.round(totalAmount * 100),
      currency: 'INR'
    }, 'Order initialized. Proceed to payment.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Razorpay payment signature & update stock/status
 * @route   POST /order/verify
 * @access  Private (Customer)
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(res, 'Missing payment parameters for verification', 400);
    }

    // Verify payment signature
    const isAuthentic = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isAuthentic) {
      // Mark local order payment as failed
      await Order.findOneAndUpdate({ razorpayOrderId }, { paymentStatus: 'failed' });
      return errorResponse(res, 'Payment signature verification failed. Counterfeit signature.', 400);
    }

    // Fetch and update order
    const order = await Order.findOne({ razorpayOrderId })
      .populate('user', 'fullName email')
      .populate('products.product', 'title images');

    if (!order) {
      return errorResponse(res, 'Order details not found', 404);
    }

    // If order was already processed/paid
    if (order.paymentStatus === 'paid') {
      return successResponse(res, order, 'Payment was already verified.');
    }

    // Update statuses
    order.paymentStatus = 'paid';
    order.orderStatus = 'processing';
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    await order.save();

    // Deduct stock for products and clear cart
    for (const item of order.products) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity }
      });
    }

    // Clear user's cart
    await User.findByIdAndUpdate(order.user._id, { $set: { cart: [] } });

    // Send customer order confirmation email
    await sendOrderConfirmationEmail(order.user.email, order.user.fullName, order);

    return successResponse(res, order, 'Payment verified and order placed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's order history
 * @route   GET /my-orders
 * @access  Private (Customer)
 */
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('products.product', 'title images price category')
      .sort({ createdAt: -1 });

    return successResponse(res, orders, 'User orders retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getMyOrders
};
