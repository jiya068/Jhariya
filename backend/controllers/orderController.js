const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { createRazorpayOrder, verifyPaymentSignature, getRazorpayKeyId } = require('../services/razorpayService');
const { sendOrderConfirmationEmail } = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @desc    Create a new order & start Razorpay checkout session
 * @route   POST /api/orders/create
 * @access  Private (Authenticated Customer)
 */
const createOrder = async (req, res, next) => {
  try {
    const { products: checkoutItems, shippingAddress, paymentMethod = 'COD' } = req.body;

    if (!checkoutItems || checkoutItems.length === 0) {
      return errorResponse(res, 'Order line items cannot be empty.', 400);
    }

    let subtotal = 0;
    const orderItems = [];

    // Verify stock and calculate dynamic pricing from DB
    for (const item of checkoutItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return errorResponse(res, `Product not found: ${item.productId}`, 404);
      }

      if (product.stock < item.quantity) {
        return errorResponse(res, `Insufficient stock for '${product.title}'. Only ${product.stock} left.`, 400);
      }

      const activePrice = product.price;
      subtotal += activePrice * item.quantity;
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        size: item.size || 'M',
        price: activePrice
      });
    }

    // Shipping rules: Free delivery for orders above/equal to ₹2000, else ₹99
    const shipping = subtotal >= 2000 ? 0 : 99;
    const total = subtotal + shipping;

    // Generate tracking ID automatically (Format: JH-2026-XXXX)
    const trackingId = `JH-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = new Order({
      userId: req.user._id,
      products: orderItems,
      subtotal,
      shipping,
      total,
      shippingAddress,
      trackingId,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: paymentMethod === 'COD' ? 'processing' : 'pending'
    });

    if (paymentMethod === 'COD') {
      await order.save();

      // Deduct inventory stock immediately for COD orders
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity }
        });
      }

      // Clear cart in user doc
      await User.findByIdAndUpdate(req.user._id, { $set: { cart: [] } });

      // Send confirmation email
      try {
        const fullOrder = await Order.findById(order._id).populate('products.product', 'title images');
        await sendOrderConfirmationEmail(req.user.email, req.user.fullName, fullOrder || order);
      } catch (e) {
        console.error('Email confirmation error (COD):', e.message);
      }

      return successResponse(res, {
        orderId: order._id,
        trackingId: order.trackingId,
        total: order.total,
        paymentMethod: 'COD',
        isCOD: true
      }, 'Order placed successfully with Cash on Delivery.');
    }

    // Payment Method: Razorpay
    const rzpKey = getRazorpayKeyId();
    const isPlaceholder = !rzpKey || rzpKey.includes('placeholder');

    let rzpOrder = null;
    if (!isPlaceholder) {
      try {
        rzpOrder = await createRazorpayOrder(total, order._id.toString());
        order.razorpayOrderId = rzpOrder.id;
      } catch (rzpErr) {
        console.error('Razorpay order creation failed:', rzpErr.message);
        return errorResponse(res, `Razorpay Order creation failed: ${rzpErr.message}`, 400);
      }
    } else {
      console.warn('Placeholder Razorpay credentials detected. Generating mock Razorpay Order ID.');
      order.razorpayOrderId = `rzp_order_mock_${Date.now()}`;
    }

    await order.save();

    return successResponse(res, {
      orderId: order._id,
      razorpayOrderId: order.razorpayOrderId,
      key: rzpKey || 'rzp_test_placeholder_key',
      amount: Math.round(total * 100), // paise
      currency: 'INR',
      trackingId,
      paymentMethod: 'Razorpay',
      isCOD: false
    }, 'Order initialized for Razorpay payment.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Razorpay payment signature & update database
 * @route   POST /api/orders/verify
 * @access  Private (Authenticated Customer)
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return errorResponse(res, 'Payment verification details missing.', 400);
    }

    // Check if mock/placeholder payment or real signature verification
    const isMock = razorpayOrderId.startsWith('rzp_order_mock_');
    let isAuthentic = false;

    if (isMock) {
      isAuthentic = true;
    } else {
      if (!razorpaySignature) {
        return errorResponse(res, 'Payment signature is missing.', 400);
      }
      isAuthentic = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    }

    if (!isAuthentic) {
      await Order.findOneAndUpdate({ razorpayOrderId }, { paymentStatus: 'failed' });
      return errorResponse(res, 'Invalid signature. Payment verification failed.', 400);
    }

    const order = await Order.findOne({ razorpayOrderId })
      .populate('userId', 'fullName email')
      .populate('products.product', 'title images');

    if (!order) {
      return errorResponse(res, 'Order details not found.', 404);
    }

    if (order.paymentStatus === 'paid') {
      return successResponse(res, order, 'Payment was already verified.');
    }

    // Update statuses
    order.paymentStatus = 'paid';
    order.orderStatus = 'processing';
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature || 'mock_sig';
    await order.save();

    // Deduct inventory stock
    for (const item of order.products) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity }
      });
    }

    // Clear cart in user doc
    await User.findByIdAndUpdate(order.userId._id, { $set: { cart: [] } });

    // Send customer order confirmation email
    await sendOrderConfirmationEmail(order.userId.email, order.userId.fullName, order);

    return successResponse(res, order, 'Payment verified and order placed successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged in user's order history
 * @route   GET /api/orders/my-orders
 * @access  Private (Authenticated Customer)
 */
const getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('products.product', 'title image images price');
    return successResponse(res, orders, 'User orders retrieved.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getUserOrders
};
