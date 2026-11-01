const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { sendOrderStatusUpdateEmail } = require('../services/emailService');

// Sign JWT token helper
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @desc    Login Admin
 * @route   POST /admin/login
 * @access  Public
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Guard checking if they have admin access
    if (user.role !== 'admin') {
      return errorResponse(res, 'Access denied. Account is not registered as Admin.', 403);
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

    return successResponse(res, { admin: adminData, token }, 'Admin logged in successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all products (Admin view)
 * @route   GET /admin/products
 * @access  Private (Admin)
 */
const getAdminProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return successResponse(res, products, `Fetched ${products.length} products`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all orders (Admin view)
 * @route   GET /admin/orders
 * @access  Private (Admin)
 */
const getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'fullName email phone')
      .populate('products.product', 'title images price category')
      .sort({ createdAt: -1 });
      
    return successResponse(res, orders, `Fetched ${orders.length} orders`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Order Status and tracking ID
 * @route   PUT /admin/order-status/:id
 * @access  Private (Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, trackingId } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate('user', 'fullName email');
      
    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    if (orderStatus) {
      order.orderStatus = orderStatus;
    }
    if (trackingId !== undefined) {
      order.trackingId = trackingId;
    }

    await order.save();

    // Trigger Nodemailer status update email notification
    if (orderStatus && order.user && order.user.email) {
      await sendOrderStatusUpdateEmail(order.user.email, order.user.fullName, order);
    }

    return successResponse(res, order, `Order status updated to: ${order.orderStatus}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Admin Dashboard Analytics
 * @route   GET /admin/dashboard
 * @access  Private (Admin)
 */
const getAdminDashboard = async (req, res, next) => {
  try {
    // 1. Total Revenue
    const revenueObj = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueObj.length > 0 ? revenueObj[0].total : 0;

    // 2. Total Orders count
    const totalOrders = await Order.countDocuments();

    // 3. Total Products count
    const totalProducts = await Product.countDocuments();

    // 4. Total Customers count
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    // 5. Monthly Sales (Paid orders aggregated by year/month)
    const monthlySales = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          sales: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Format monthly sales for easier presentation
    const formattedMonthlySales = monthlySales.map(item => {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return {
        month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
        sales: item.sales,
        orderCount: item.count
      };
    });

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
        category: item.details.category,
        images: item.details.images,
        totalSold: item.totalSold,
        revenue: item.revenue
      }));

    // 7. Recent Orders (last 5)
    const recentOrders = await Order.find()
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5);

    const dashboardData = {
      totalRevenue,
      totalOrders,
      totalProducts,
      totalCustomers,
      monthlySales: formattedMonthlySales,
      topSellingProducts: formattedTopProducts,
      recentOrders
    };

    return successResponse(res, dashboardData, 'Fetched admin dashboard analytics');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminLogin,
  getAdminProducts,
  getAdminOrders,
  updateOrderStatus,
  getAdminDashboard
};
