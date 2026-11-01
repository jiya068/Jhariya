require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

// Configurations & Database
const connectDB = require('./config/db');
const User = require('./models/User');

// Middlewares
const xssClean = require('./middlewares/xssMiddleware');
const errorHandler = require('./middlewares/errorMiddleware');

// Routes
const apiRouter = require('./routes/api');

// Initialize app
const app = express();

// Connect to Database
connectDB().then(() => {
  // Seed admin user after successful DB connection
  seedAdmin();
});

// ==========================================
// SECURITY MIDDLEWARES
// ==========================================

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP during development to avoid blocking external assets/CDNs if running frontend
}));

// Enable CORS
app.use(cors());

// Rate Limiting (Prevent Brute Force)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ==========================================
// REQUEST PARSING & SANITIZATION
// ==========================================

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanitize data against MongoDB operator injection
app.use(mongoSanitize());

// Sanitize inputs against XSS attacks
app.use(xssClean);

// ==========================================
// STATIC FILES & API ROUTES
// ==========================================

// Serve static frontend files (if run locally, users can load the index.html on root)
app.use(express.static(path.join(__dirname, '../')));

// API router
app.use('/api', apiRouter);

// Fallback for SPA (Frontend routing support if index.html is loaded directly)
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Centralized error handler middleware
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
