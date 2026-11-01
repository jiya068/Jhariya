const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { sendOrderStatusUpdateEmail } = require('../services/emailService');

// Sign JWT helper
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @desc    Login Admin
 * @route   POST /api/admin/login
 * @access  Public
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 'Invalid credentials.', 401);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid credentials.', 401);
    }

    if (user.role !== 'admin') {
      return errorResponse(res, 'Access denied. Account is not an Admin.', 403);
    }

    const token = signToken(user._id);

    const adminData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt
    };

    return successResponse(res, { admin: adminData, token }, 'Admin logged in successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all orders (Admin view)
 * @route   GET /api/admin/orders
 * @access  Private (Admin)
 */
const getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('userId', 'fullName email phone')
      .populate('products.product', 'title images price')
      .sort({ createdAt: -1 });
      
    return successResponse(res, orders, `Fetched ${orders.length} orders successfully.`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Order fulfillment status
 * @route   PUT /api/admin/order/:id
 * @access  Private (Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, trackingId } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id).populate('userId', 'fullName email');
    if (!order) {
      return errorResponse(res, 'Order not found.', 404);
    }

    if (orderStatus) {
      order.orderStatus = orderStatus;
    }
    if (trackingId !== undefined) {
      order.trackingId = trackingId;
    }

    await order.save();

    // Notify customer on change
    if (orderStatus && order.userId && order.userId.email) {
      await sendOrderStatusUpdateEmail(order.userId.email, order.userId.fullName, order);
    }

    return successResponse(res, order, `Order status updated to ${order.orderStatus}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Admin Dashboard Analytics
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
const getAdminDashboard = async (req, res, next) => {
  try {
    // 1. Total Revenue (Paid orders)
    const revenueObj = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueObj.length > 0 ? revenueObj[0].total : 0;

    // 2. Total Orders
    const totalOrders = await Order.countDocuments();

    // 3. Total Customers
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    // 4. Total Products
    const totalProducts = await Product.countDocuments();

    // 5. Recent Orders (last 5)
    const recentOrders = await Order.find()
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5);

    // 6. Top Selling Products
    const topSellingProducts = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product',
          totalSold: { $sum: '$products.quantity' },
          revenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'details'
        }
      },
      { $unwind: { path: '$details', preserveNullAndEmptyArrays: true } }
    ]);

    const formattedTopProducts = topSellingProducts
      .filter(item => item.details)
      .map(item => ({
        productId: item._id,
        title: item.details.title,
        fabric: item.details.fabric,
        style: item.details.style,
        images: item.details.images,
        totalSold: item.totalSold,
        revenue: item.revenue
      }));

    const dashboardData = {
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
      recentOrders,
      topSellingProducts: formattedTopProducts
    };

    return successResponse(res, dashboardData, 'Dashboard statistics fetched successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminLogin,
  getAdminOrders,
  updateOrderStatus,
  getAdminDashboard
};
