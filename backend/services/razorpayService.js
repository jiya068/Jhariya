const crypto = require('crypto');
const Razorpay = require('razorpay');

/**
 * Get active Razorpay Key ID from environment variables
 */
const getRazorpayKeyId = () => {
  const key = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || '';
  return key.trim();
};

/**
 * Get active Razorpay Key Secret from environment variables
 */
const getRazorpaySecret = () => {
  const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';
  return secret.trim();
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
 * Creates a Razorpay checkout order
 * @param {number} amount - Amount in INR
 * @param {string} receipt - Receipt reference
 * @returns {Promise<object>} Razorpay order object
 */
const createRazorpayOrder = async (amount, receipt) => {
  try {
    const razorpay = getRazorpayInstance();
    const options = {
      amount: Math.round(amount * 100), // convert to paise
      currency: 'INR',
      receipt: receipt
    };
    
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    throw new Error(error.message || 'Razorpay order creation failed.');
  }
};

/**
 * Verifies the signature from Razorpay checkout
 * @param {string} orderId - Razorpay Order ID
 * @param {string} paymentId - Razorpay Payment ID
 * @param {string} signature - Razorpay Signature
 * @returns {boolean} Whether payment is verified
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const secret = getRazorpaySecret();
    if (!secret) {
      console.error('Razorpay secret missing for signature verification.');
      return false;
    }
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');
      
    return expectedSignature === signature;
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

