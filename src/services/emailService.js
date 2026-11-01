const transporter = require('../config/nodemailer');

/**
 * Sends a generic HTML email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body content
 */
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Jhariya" <noreply@jhariya.com>',
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error.message);
    // Do not crash the app if email fails
    return null;
  }
};

/**
 * Sends an order confirmation email
 * @param {string} toEmail - Recipient email
 * @param {string} customerName - Customer's name
 * @param {object} order - Order document details
 */
const sendOrderConfirmationEmail = async (toEmail, customerName, order) => {
  const itemsList = order.products
    .map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${item.product.title || 'Product'}</strong><br>
          <small>Size: ${item.size} | Qty: ${item.quantity}</small>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ₹${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `)
    .join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #1a1a1a; text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; text-transform: uppercase; letter-spacing: 2px;">Jhariya</h2>
      <p>Dear ${customerName},</p>
      <p>Thank you for shopping with Jhariya! Your order has been successfully placed. Below are your order details:</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Order ID:</strong> ${order._id}</p>
        <p style="margin: 0 0 10px 0;"><strong>Payment Status:</strong> ${order.paymentStatus.toUpperCase()}</p>
        <p style="margin: 0;"><strong>Order Status:</strong> ${order.orderStatus.toUpperCase()}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Items</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 10px; font-weight: bold; text-align: right;">Subtotal:</td>
            <td style="padding: 10px; text-align: right;">₹${order.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; text-align: right;">Shipping:</td>
            <td style="padding: 10px; text-align: right;">₹${order.shippingCharge.toFixed(2)}</td>
          </tr>
          <tr style="font-size: 1.1em; font-weight: bold; background-color: #fdfdfd;">
            <td style="padding: 10px; text-align: right; border-top: 1px solid #333;">Total Paid:</td>
            <td style="padding: 10px; text-align: right; border-top: 1px solid #333; color: #b33939;">₹${order.totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 25px;">
        <h4 style="border-bottom: 1px solid #eee; padding-bottom: 5px;">Delivery Address:</h4>
        <p style="margin: 5px 0;">${order.shippingAddress.street}</p>
        <p style="margin: 5px 0;">${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}</p>
        <p style="margin: 5px 0;">${order.shippingAddress.country}</p>
      </div>

      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="text-align: center; color: #777; font-size: 0.85em;">
        If you have any questions, please contact us at ${process.env.EMAIL_USER} or chat with us on WhatsApp at ${order.whatsappNumber || 'our support number'}.
      </p>
    </div>
  `;

  return sendEmail(toEmail, `Order Confirmation - #${order._id}`, htmlContent);
};

/**
 * Sends an order status update email
 * @param {string} toEmail - Recipient email
 * @param {string} customerName - Customer's name
 * @param {object} order - Order details
 */
const sendOrderStatusUpdateEmail = async (toEmail, customerName, order) => {
  let statusMessage = '';
  switch (order.orderStatus) {
    case 'processing':
      statusMessage = 'Your order is currently being prepared and packaged.';
      break;
    case 'shipped':
      statusMessage = `Great news! Your order has been shipped. ${order.trackingId ? `You can track it using tracking ID: <strong>${order.trackingId}</strong>` : ''}`;
      break;
    case 'delivered':
      statusMessage = 'Your order has been delivered. We hope you love your new wardrobe addition!';
      break;
    case 'cancelled':
      statusMessage = 'Your order has been cancelled. If this is a mistake, please reach out to our customer support.';
      break;
    default:
      statusMessage = `Your order status has been updated to: <strong>${order.orderStatus}</strong>.`;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #1a1a1a; text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; text-transform: uppercase; letter-spacing: 2px;">Jhariya</h2>
      <p>Dear ${customerName},</p>
      <p>We are writing to update you on your order <strong>#${order._id}</strong>.</p>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #1a1a1a;">
        <p style="margin: 0; font-size: 1.1em; line-height: 1.5;">${statusMessage}</p>
      </div>

      <p><strong>Current Order Status:</strong> ${order.orderStatus.toUpperCase()}</p>
      ${order.trackingId ? `<p><strong>Tracking ID:</strong> ${order.trackingId}</p>` : ''}

      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="text-align: center; color: #777; font-size: 0.85em;">
        Jhariya E-Commerce - Thank you for choosing us!
      </p>
    </div>
  `;

  return sendEmail(toEmail, `Order Status Update: #${order._id}`, htmlContent);
};

module.exports = {
  sendEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail
};
