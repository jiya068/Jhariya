const Razorpay = require('razorpay');

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || 'rzp_test_placeholder_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || 'rzp_test_placeholder_secret'
});

module.exports = razorpayInstance;
