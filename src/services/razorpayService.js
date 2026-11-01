const crypto = require('crypto');
const Razorpay = require('razorpay');

/**
 * Get active Razorpay Key ID from environment variables
 */
const getRazorpayKeyId = () => {
  return process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || '';
};

/**
 * Get active Razorpay Key Secret from environment variables
 */
const getRazorpaySecret = () => {
  return process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';
};

/**
 * Get fresh Razorpay SDK Instance initialized with env credentials
 */
const getRazorpayInstance = () => {
  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpaySecret();
  
  if (!key_id || !key_secret) {
    throw new Error('Razorpay Key ID or Key Secret missing in server environment.');
  }

  return new Razorpay({ key_id, key_secret });
};

/**
 * Creates a Razorpay payment order
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} receipt - Unique identifier/receipt ID for reference
 * @returns {Promise<object>} Razorpay order details
 */
const createRazorpayOrder = async (amount, receipt) => {
  try {
    const razorpay = getRazorpayInstance();
    const options = {
      amount: Math.round(amount * 100), // Razorpay accepts amounts in paise
      currency: 'INR',
      receipt: receipt
    };
    
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    throw new Error(error.message || 'Razorpay Order Creation Failed');
  }
};

/**
 * Verifies Razorpay signature
 * @param {string} razorpayOrderId - Razorpay Order ID
 * @param {string} razorpayPaymentId - Razorpay Payment ID
 * @param {string} razorpaySignature - Razorpay payment signature
 * @returns {boolean} Whether the payment is authentic
 */
const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  try {
    const secret = getRazorpaySecret();
    if (!secret) {
      console.error('Razorpay secret missing for signature verification.');
      return false;
    }
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');
      
    return expectedSignature === razorpaySignature;
  } catch (error) {
    console.error('Razorpay signature verification error:', error);
    return false;
  }
};

module.exports = {
  getRazorpayKeyId,
  getRazorpaySecret,
  createRazorpayOrder,
  verifyPaymentSignature
};

