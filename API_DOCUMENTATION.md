# Jhariya E-commerce API Documentation

This documentation covers all public, customer, and admin REST API endpoints for the Jhariya E-commerce backend.

All API routes are prefixed with `/api`. Standard responses return JSON format.

---

## 1. Authentication & User APIs

### Register Customer
* **Endpoint**: `POST /api/auth/register`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123",
    "phone": "+919876543210"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "_id": "60d5ec4b1234567890abcdef",
        "fullName": "John Doe",
        "email": "john@example.com",
        "phone": "+919876543210",
        "role": "customer",
        "createdAt": "2026-06-14T12:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### Login Customer
* **Endpoint**: `POST /api/auth/login`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Logged in successfully",
    "data": {
      "user": {
        "_id": "60d5ec4b1234567890abcdef",
        "fullName": "John Doe",
        "email": "john@example.com",
        "phone": "+919876543210",
        "role": "customer",
        "addresses": [],
        "wishlist": [],
        "cart": [],
        "createdAt": "2026-06-14T12:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

---

## 2. Product APIs

### Get All Products
* **Endpoint**: `GET /api/products`
* **Access**: Public
* **Query Parameters (Optional)**:
  - `category`: Filter by product category (e.g. `Kurtas`, `Sarees`)
  - `search`: Full text search on `title` or `description`
  - `isFeatured`: `true` or `false`
  - `isNewArrival`: `true` or `false`
  - `isBestSeller`: `true` or `false`
  - `sort`: `priceAsc`, `priceDesc`, `rating` (default: newest)
  - `page`: Page number (default: `1`)
  - `limit`: Number of items per page (default: `10`)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Products fetched successfully",
    "data": {
      "products": [
        {
          "_id": "60d5ec4b1234567890abcde1",
          "title": "Designer Chanderi Kurta",
          "slug": "designer-chanderi-kurta",
          "description": "Elegant handwoven designer Chanderi kurta.",
          "price": 2999,
          "salePrice": 2499,
          "fabric": "Chanderi Silk",
          "style": "Straight Fit",
          "sizes": ["S", "M", "L"],
          "stock": 45,
          "images": ["https://res.cloudinary.com/.../img1.jpg"],
          "rating": 4.5,
          "reviewCount": 12,
          "category": "Kurtas",
          "isFeatured": true,
          "isNewArrival": true,
          "isBestSeller": false
        }
      ],
      "pagination": {
        "total": 1,
        "page": 1,
        "limit": 10,
        "pages": 1
      }
    }
  }
  ```

### Get Single Product Details
* **Endpoint**: `GET /api/product/:slug`
* **Access**: Public
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Product details fetched successfully",
    "data": {
      "product": {
        "_id": "60d5ec4b1234567890abcde1",
        "title": "Designer Chanderi Kurta",
        "slug": "designer-chanderi-kurta",
        "price": 2999,
        "salePrice": 2499,
        "fabric": "Chanderi Silk",
        "style": "Straight Fit",
        "sizes": ["S", "M", "L"],
        "stock": 45,
        "images": ["https://res.cloudinary.com/.../img1.jpg"]
      },
      "reviews": [
        {
          "_id": "60d5ec4b1234567890abcde9",
          "rating": 5,
          "reviewText": "Amazing quality, feels very premium!",
          "user": {
            "_id": "60d5ec4b1234567890abcdef",
            "fullName": "John Doe"
          },
          "createdAt": "2026-06-14T13:00:00.000Z"
        }
      ]
    }
  }
  ```

---

## 3. Cart APIs (Requires Authorization Header)
*Header format: `Authorization: Bearer <TOKEN>`*

### Add Item to Cart
* **Endpoint**: `POST /api/cart/add`
* **Request Body**:
  ```json
  {
    "productId": "60d5ec4b1234567890abcde1",
    "quantity": 2,
    "size": "M"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Item added to cart successfully",
    "data": [
      {
        "product": "60d5ec4b1234567890abcde1",
        "quantity": 2,
        "size": "M",
        "_id": "60d5ec4b1234567890abcde2"
      }
    ]
  }
  ```

### Get Cart
* **Endpoint**: `GET /api/cart`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Cart retrieved successfully",
    "data": [
      {
        "_id": "60d5ec4b1234567890abcde2",
        "product": {
          "_id": "60d5ec4b1234567890abcde1",
          "title": "Designer Chanderi Kurta",
          "price": 2999,
          "salePrice": 2499,
          "images": ["https://res.cloudinary.com/.../img1.jpg"],
          "stock": 45
        },
        "quantity": 2,
        "size": "M"
      }
    ]
  }
  ```

### Update Cart Item Quantity
* **Endpoint**: `PUT /api/cart/:itemId`
* **Request Body**:
  ```json
  {
    "quantity": 3
  }
  ```

### Delete Cart Item
* **Endpoint**: `DELETE /api/cart/:itemId`

---

## 4. Wishlist APIs (Requires Authorization Header)

### Toggle Wishlist Item
* **Endpoint**: `POST /api/wishlist/add`
* **Request Body**:
  ```json
  {
    "productId": "60d5ec4b1234567890abcde1"
  }
  ```
* **Success Response (200 OK)**: Returns updated array of wishlist product IDs.

### Get Wishlist
* **Endpoint**: `GET /api/wishlist`

---

## 5. Review APIs (Requires Authorization Header)

### Add/Update Product Review
* **Endpoint**: `POST /api/review/add`
* **Request Body**:
  ```json
  {
    "productId": "60d5ec4b1234567890abcde1",
    "rating": 5,
    "reviewText": "Great fabric and fast delivery!"
  }
  ```
* **Success Response (201 Created / 200 OK)**:
  *Review starts as `approved: false` and must be validated by the admin.*

---

## 6. Checkout & Order APIs (Requires Authorization Header)

### Create Order (Initiate Razorpay)
* **Endpoint**: `POST /api/order/create`
* **Request Body**:
  ```json
  {
    "products": [
      {
        "productId": "60d5ec4b1234567890abcde1",
        "quantity": 1,
        "size": "M"
      }
    ],
    "shippingAddress": {
      "street": "123 MG Road",
      "city": "Bengaluru",
      "state": "Karnataka",
      "postalCode": "560001"
    }
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Order initialized. Proceed to payment.",
    "data": {
      "orderId": "60d5ec4b1234567890abcde8",
      "razorpayOrderId": "order_H7a8Dfk90JsnB1",
      "amount": 249900,
      "currency": "INR"
    }
  }
  ```

### Verify Razorpay Payment Signature
* **Endpoint**: `POST /api/order/verify`
* **Request Body**:
  ```json
  {
    "razorpayOrderId": "order_H7a8Dfk90JsnB1",
    "razorpayPaymentId": "pay_H7aD0sKjd9snB2",
    "razorpaySignature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```
* **Success Response (200 OK)**:
  *Updates paymentStatus to 'paid', orderStatus to 'processing', sends confirmation email, and returns order object.*

### Get My Orders
* **Endpoint**: `GET /api/my-orders`

---

## 7. Site Settings (Public Config)

### Get Store Settings
* **Endpoint**: `GET /api/settings`
* **Access**: Public
* **Success Response (200 OK)**: Retrieves brandName, aboutUs, contact email, socials, logoUrl, and hero banner arrays.

---

## 8. Admin APIs

### Login Admin
* **Endpoint**: `POST /api/admin/login`
* **Access**: Public
* **Request Body**:
  ```json
  {
    "email": "admin@jhariya.com",
    "password": "AdminPassword123"
  }
  ```
* **Success Response (200 OK)**: Returns JWT admin token.

### Admin Dashboard Analytics (Requires Admin Guard)
* **Endpoint**: `GET /api/admin/dashboard`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Fetched admin dashboard analytics",
    "data": {
      "totalRevenue": 2499,
      "totalOrders": 1,
      "totalProducts": 15,
      "totalCustomers": 120,
      "monthlySales": [
        {
          "month": "June 2026",
          "sales": 2499,
          "orderCount": 1
        }
      ],
      "topSellingProducts": [
        {
          "productId": "60d5ec4b1234567890abcde1",
          "title": "Designer Chanderi Kurta",
          "category": "Kurtas",
          "images": ["https://res.cloudinary.com/..."],
          "totalSold": 1,
          "revenue": 2499
        }
      ],
      "recentOrders": []
    }
  }
  ```

### Create Product (Requires Admin Guard)
* **Endpoint**: `POST /api/admin/create-product`
* **Content-Type**: `multipart/form-data`
* **Body Fields**:
  - `title`: String
  - `description`: String
  - `price`: Number
  - `salePrice`: Number (Optional)
  - `fabric`: String
  - `style`: String
  - `sizes`: String (comma-separated, e.g. `S,M,L`) or Array
  - `stock`: Number
  - `category`: String
  - `isFeatured`: `true` or `false`
  - `isNewArrival`: `true` or `false`
  - `isBestSeller`: `true` or `false`
  - `images`: Image file uploads (multiple, field name must be `images`, max 5 files)

### Update Product (Requires Admin Guard)
* **Endpoint**: `PUT /api/admin/update-product/:id`
* **Content-Type**: `multipart/form-data`
* **Body Fields**:
  - Supports all Create Product fields.
  - `existingImages`: Array or comma-separated string of current product image URLs to retain. Replaced/removed URLs will be deleted from Cloudinary automatically.
  - `images`: Upload files for newly appended images.

### Delete Product
* **Endpoint**: `DELETE /api/admin/delete-product/:id`

### Update Order Fulfillment Status (Requires Admin Guard)
* **Endpoint**: `PUT /api/admin/order-status/:id`
* **Request Body**:
  ```json
  {
    "orderStatus": "shipped",
    "trackingId": "DTDC987654321"
  }
  ```
  *Fires an order status notification email automatically via Nodemailer.*

### Edit Site Settings (Requires Admin Guard)
* **Endpoint**: `PUT /api/admin/settings`
* **Content-Type**: `multipart/form-data`
* **Body Fields**:
  - `brandName`: String
  - `aboutUs`: String
  - `contactEmail`: String
  - `whatsappNumber`: String
  - `instagramLink`: String
  - `facebookLink`: String
  - `returnPolicy`: String
  - `shippingPolicy`: String
  - `existingHeroBannerImages`: Array/CSV of existing URLs to retain
  - `logo`: Single file upload (field name `logo`)
  - `heroBannerImages`: Multiple files upload (field name `heroBannerImages`)

### Review Moderation (Requires Admin Guard)
* **GET /api/admin/reviews**: List all reviews for approval checklist
* **PUT /api/admin/review-approve/:id**: Body: `{ "approved": true }` to publish and recalculate product ratings
* **DELETE /api/admin/review/:id**: Remove spam reviews
