require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

// Configurations
const connectDB = require('./config/db');
const User = require('./models/User');

// Middlewares
const xssClean = require('./middleware/xssMiddleware');
const errorHandler = require('./middleware/errorMiddleware');

// Routes
const apiRouter = require('./routes/api');

const app = express();

// Database Connection & Seed Trigger
connectDB().then(() => {
  initUsersPersistence();
  seedProducts();
});

// ==========================================
// SECURITY MIDDLEWARES
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP during development
}));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow localhost on any port, and any .vercel.app domain for production
    const allowedPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/.*\.vercel\.app$/;
    if (allowedPattern.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all in dev; restrict in production
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Request Parsing & Sanitizers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());
app.use(xssClean);

// Serve uploaded product images from backend/uploads at /uploads/ path
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../')));

// Mount API router
app.use('/api', apiRouter);

// Serve index.html as a fallback for SPA routes
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Central error handler
app.use(errorHandler);

// ==========================================
// DEFAULT ADMIN ACCOUNT SEEDING & PERSISTENCE
// ==========================================
const { 
  loadProductsFromFile, 
  saveProductsToFile, 
  loadUsersFromFile, 
  saveUsersToFile 
} = require('./services/persistenceService');

async function initUsersPersistence() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const savedUsers = await loadUsersFromFile();
      if (savedUsers && savedUsers.length > 0) {
        await User.insertMany(savedUsers);
        console.log(`[Persistence] Restored ${savedUsers.length} users from users.json storage file.`);
      }
      await saveUsersToFile();
    } else {
      await saveUsersToFile();
    }
  } catch (err) {
    console.error('Failed to initialize users persistence:', err.message);
  }
}

async function seedProducts() {
  try {
    const Product = require('./models/Product');
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      const savedProducts = await loadProductsFromFile();
      if (savedProducts && savedProducts.length > 0) {
        await Product.insertMany(savedProducts);
        console.log(`[Persistence] Restored ${savedProducts.length} custom products from products.json storage file.`);
      } else {
        const generateKurtiViews = (title, colorHex, accentHex) => {
          return [
            { label: "Front Silhouette View", detail: "Full Length Fit" },
            { label: "Fabric & Work Detail", detail: "Handcrafted Motif" },
            { label: "Side Flare & Back View", detail: "Tailored Angle" }
          ].map(v => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
              <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FAF7F2"/>
                  <stop offset="100%" stop-color="#EFE6D8"/>
                </linearGradient>
                <linearGradient id="fabric" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="${colorHex}"/>
                  <stop offset="100%" stop-color="${accentHex}"/>
                </linearGradient>
              </defs>
              <rect width="600" height="800" fill="url(#bg)"/>
              <rect x="30" y="30" width="540" height="740" rx="12" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.4"/>
              <path d="M240 140 Q300 160 360 140 L440 240 L390 265 L370 215 L380 680 L220 680 L230 215 L210 265 L160 240 Z" fill="url(#fabric)" opacity="0.95"/>
              <path d="M260 140 Q300 185 340 140" fill="none" stroke="#D4AF37" stroke-width="3"/>
              <text x="300" y="725" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#2D0B12" text-anchor="middle">${title}</text>
              <text x="300" y="750" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#B8860B" text-anchor="middle">✨ ${v.label} (${v.detail})</text>
            </svg>`;
            return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
          });
        };

        const defaultProducts = [
          {
            title: "Saffron Gold Block Print A-Line",
            description: "A gorgeous gold foil block printed Kurti in premium cambric cotton, featuring a classic A-line silhouette and elegant three-quarter sleeves.",
            price: 1699,
            fabric: "Pure Cotton",
            style: "A-Line",
            color: "Saffron Gold",
            embroidery: "Gota Patti Work",
            sleeve: "3/4 Sleeve",
            neck: "V-Neck",
            fit: "Regular Fit",
            washCare: "Gentle Hand Wash",
            length: "44 Inches",
            stock: 50,
            sizes: ["S", "M", "L", "XL", "XXL"],
            images: generateKurtiViews("Saffron Gold Block Print A-Line", "#E6A100", "#996B00"),
            featured: true,
            newArrival: true,
            bestseller: false
          },
          {
            title: "Ivory Georgette Chikankari Kurti",
            description: "Handcrafted Lucknowi Chikankari embroidery on soft, semi-transparent ivory georgette. Comes with a matching cotton inner.",
            price: 2499,
            fabric: "Georgette",
            style: "Straight",
            color: "Ivory White",
            embroidery: "Lucknowi Chikankari",
            sleeve: "Full Sleeve",
            neck: "Round Neck",
            fit: "Straight Fit",
            washCare: "Dry Clean Only",
            length: "46 Inches",
            stock: 30,
            sizes: ["M", "L", "XL"],
            images: generateKurtiViews("Ivory Georgette Chikankari Kurti", "#F5F5EC", "#D9D9C3"),
            featured: true,
            newArrival: false,
            bestseller: true
          },
          {
            title: "Mint Whispers Rayon Kurti",
            description: "Sleek and flowing luxe rayon Kurti in a soothing mint green hue, featuring delicate lace details on the neck and cuffs.",
            price: 1299,
            fabric: "Luxe Rayon",
            style: "Umbrella Cut",
            color: "Mint Green",
            embroidery: "Lace Work",
            sleeve: "Bell Sleeve",
            neck: "Keyhole Neck",
            fit: "Relaxed Fit",
            washCare: "Machine Wash Cold",
            length: "42 Inches",
            stock: 40,
            sizes: ["S", "M", "L", "XL"],
            images: generateKurtiViews("Mint Whispers Rayon Kurti", "#78C2AD", "#3B8270"),
            featured: false,
            newArrival: true,
            bestseller: false
          },
          {
            title: "Indigo Chanderi Silk Kurta",
            description: "Rich indigo handloom Chanderi silk Kurta with a subtle gold zari border. Perfect for festive and special occasions.",
            price: 2999,
            fabric: "Chanderi Silk",
            style: "Anarkali",
            color: "Indigo Blue",
            embroidery: "Zari Work",
            sleeve: "3/4 Sleeve",
            neck: "Mandarin Collar",
            fit: "Flared Fit",
            washCare: "Dry Clean Only",
            length: "48 Inches",
            stock: 25,
            sizes: ["S", "M", "L", "XL", "XXL"],
            images: generateKurtiViews("Indigo Chanderi Silk Kurta", "#1B2A4A", "#0C1527"),
            featured: false,
            newArrival: false,
            bestseller: true
          }
        ];
        await Product.insertMany(defaultProducts);
        await saveProductsToFile();
        console.log('Seeded default catalog with multi-photo Kurti items and persisted to products.json.');
      }
    } else {
      await saveProductsToFile();
    }
  } catch (err) {
    console.error('Failed to seed default products:', err.message);
  }
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection Error: ${err.message}`);
  server.close(() => process.exit(1));
});
