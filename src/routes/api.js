const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  registerValidator,
  loginValidator,
  productValidator,
  reviewValidator,
  orderValidator
} = require('../middlewares/validationMiddleware');

// Controllers
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const wishlistController = require('../controllers/wishlistController');
const reviewController = require('../controllers/reviewController');
const orderController = require('../controllers/orderController');
const settingsController = require('../controllers/settingsController');

// ==========================================
// CUSTOMER & PUBLIC API ROUTES
// ==========================================

// Authentication
router.post('/auth/register', registerValidator, authController.register);
router.post('/auth/login', loginValidator, authController.login);

// Products
router.get('/products', productController.getProducts);
router.get('/product/:slug', productController.getProductBySlug);

// Cart (Protected)
router.post('/cart/add', verifyToken, cartController.addToCart);
router.get('/cart', verifyToken, cartController.getCart);
router.put('/cart/:itemId', verifyToken, cartController.updateCartItem);
router.delete('/cart/:itemId', verifyToken, cartController.removeCartItem);

// Wishlist (Protected)
router.post('/wishlist/add', verifyToken, wishlistController.toggleWishlist);
router.get('/wishlist', verifyToken, wishlistController.getWishlist);

// Reviews (Protected)
router.post('/review/add', verifyToken, reviewValidator, reviewController.addReview);

// Orders & Checkout (Protected)
router.post('/order/create', verifyToken, orderValidator, orderController.createOrder);
router.post('/order/verify', verifyToken, orderController.verifyPayment);
router.get('/my-orders', verifyToken, orderController.getMyOrders);

// Site Settings (Public Read)
router.get('/settings', settingsController.getSettings);

// ==========================================
// ADMIN API ROUTES
// ==========================================

// Admin Authentication (Public Login)
router.post('/admin/login', loginValidator, adminController.adminLogin);

// Admin Product Management
router.get('/admin/products', verifyToken, verifyAdmin, adminController.getAdminProducts);
router.post(
  '/admin/create-product',
  verifyToken,
  verifyAdmin,
  upload.array('images', 5),
  productValidator,
  productController.createProduct
);
router.put(
  '/admin/update-product/:id',
  verifyToken,
  verifyAdmin,
  upload.array('images', 5),
  productController.updateProduct
);
router.delete('/admin/delete-product/:id', verifyToken, verifyAdmin, productController.deleteProduct);

// Admin Order Management
router.get('/admin/orders', verifyToken, verifyAdmin, adminController.getAdminOrders);
router.put('/admin/order-status/:id', verifyToken, verifyAdmin, adminController.updateOrderStatus);

// Admin Dashboard Analytics
router.get('/admin/dashboard', verifyToken, verifyAdmin, adminController.getAdminDashboard);

// Admin Dynamic Site Settings
router.put(
  '/admin/settings',
  verifyToken,
  verifyAdmin,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'heroBannerImages', maxCount: 5 }
  ]),
  settingsController.updateSettings
);

// Admin Reviews Moderation
router.get('/admin/reviews', verifyToken, verifyAdmin, reviewController.getAdminReviews);
router.put('/admin/review-approve/:id', verifyToken, verifyAdmin, reviewController.approveReview);
router.delete('/admin/review/:id', verifyToken, verifyAdmin, reviewController.deleteReview);

module.exports = router;
