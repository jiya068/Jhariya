const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Controllers
const authController = require('../controllers/authController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const adminController = require('../controllers/adminController');
const settingsController = require('../controllers/settingsController');

// ==========================================
// PUBLIC & STOREFRONT ENDPOINTS
// ==========================================

// Authentication
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/profile', verifyToken, authController.getProfile);

// Public Products list and details
router.get('/products', productController.getProducts);
router.get('/products/:identifier', productController.getProductDetails);

const reviewController = require('../controllers/reviewController');

// Public Site settings
router.get('/settings', settingsController.getSettings);

// Customer Reviews & Feedback
router.get('/reviews', reviewController.getReviews);
router.post('/reviews', reviewController.addReview);
router.post('/reviews/upload-photo', upload.single('photo'), reviewController.uploadReviewPhoto);


// ==========================================
// CUSTOMER CHECKOUT ENDPOINTS (Protected)
// ==========================================
router.post('/orders/create', verifyToken, orderController.createOrder);
router.post('/orders/verify', verifyToken, orderController.verifyPayment);
router.get('/orders/my-orders', verifyToken, orderController.getUserOrders);

// ==========================================
// ADMIN PORTAL ENDPOINTS (Guarded)
// ==========================================

// Admin Authentication (Public Login)
router.post('/admin/login', adminController.adminLogin);

// Admin Catalog Management
router.get('/admin/products', verifyToken, verifyAdmin, productController.getAdminProducts);
router.post(
  '/admin/product',
  verifyToken,
  verifyAdmin,
  upload.array('images', 5),
  productController.createProduct
);
router.put(
  '/admin/product/:id',
  verifyToken,
  verifyAdmin,
  upload.array('images', 5),
  productController.updateProduct
);
router.delete('/admin/product/:id', verifyToken, verifyAdmin, productController.deleteProduct);

// Admin image upload (returns permanent server-hosted URLs)
router.post('/admin/upload-images', verifyToken, verifyAdmin, upload.array('images', 10), productController.uploadImages);


// Admin Orders Management
router.get('/admin/orders', verifyToken, verifyAdmin, adminController.getAdminOrders);
router.put('/admin/order/:id', verifyToken, verifyAdmin, adminController.updateOrderStatus);

// Admin Analytics & Profile Settings
router.get('/admin/dashboard', verifyToken, verifyAdmin, adminController.getAdminDashboard);
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

module.exports = router;
