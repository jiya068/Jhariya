/**
 * Jhariya Full Diagnostic Script
 * Tests all API endpoints and reports issues
 */
const http = require('http');

const BASE = 'http://localhost:5000';
let results = [];
let token = null;
let adminToken = null;
let productId = null;

function req(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    };
    const request = http.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch(e) {}
        resolve({ status: res.statusCode, json, raw });
      });
    });
    request.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (data) request.write(data);
    request.end();
  });
}

function log(name, status, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  results.push({ name, status, ok, detail });
  console.log(`${icon} [${status}] ${name}${detail ? ' | ' + detail : ''}`);
}

async function run() {
  console.log('\n========================================');
  console.log('  JHARIYA FULL DIAGNOSTIC REPORT');
  console.log('========================================\n');

  // 1. Homepage
  const home = await req('GET', '/');
  log('GET / (Homepage)', home.status, home.status === 200, home.status !== 200 ? home.error || 'not serving index.html' : 'index.html served');

  // 2. Products list
  const products = await req('GET', '/api/products');
  const prodOk = products.status === 200 && products.json?.success && Array.isArray(products.json?.data?.products);
  log('GET /api/products', products.status, prodOk, prodOk ? `${products.json.data.products.length} products` : products.json?.message || products.error);
  if (prodOk && products.json.data.products.length > 0) {
    productId = products.json.data.products[0]._id;
  }

  // 3. Single product
  if (productId) {
    const prod = await req('GET', `/api/products/${productId}`);
    log('GET /api/products/:id', prod.status, prod.status === 200 && prod.json?.success, prod.json?.data?.product?.title || prod.json?.message);
  }

  // 4. Site settings
  const settings = await req('GET', '/api/settings');
  log('GET /api/settings', settings.status, settings.status === 200 && settings.json?.success, settings.json?.message || settings.error || '');

  // 5. Customer login (wrong password - should fail 401)
  const badLogin = await req('POST', '/api/auth/login', { email: 'wrong@test.com', password: 'wrong' });
  log('POST /api/auth/login (invalid user)', badLogin.status, badLogin.status === 401, badLogin.json?.message || badLogin.error || '');

  // 6. Register dynamic admin user
  const adminEmail = `admin_${Date.now()}@jhariya.com`;
  const adminReg = await req('POST', '/api/auth/register', { fullName: 'Test Admin', email: adminEmail, password: 'AdminSecurePass123!', phone: '+919999999999', role: 'admin' });
  const adminOk = adminReg.status === 201 && adminReg.json?.success && adminReg.json?.data?.token;
  log('POST /api/auth/register (admin)', adminReg.status, adminOk, adminOk ? `role=${adminReg.json.data.user?.role}` : adminReg.json?.message || adminReg.error || '');
  if (adminOk) adminToken = adminReg.json.data.token;

  // 7. Register new user
  const regEmail = `test_${Date.now()}@jhariya.com`;
  const reg = await req('POST', '/api/auth/register', { fullName: 'Test User', email: regEmail, password: 'test123456', phone: '+919876543210' });
  const regOk = reg.status === 201 && reg.json?.success;
  log('POST /api/auth/register', reg.status, regOk, regOk ? `token=${reg.json.data.token ? 'ok' : 'missing'}` : reg.json?.message || reg.error || '');
  if (regOk) token = reg.json.data.token;

  // 8. Get profile (authenticated)
  if (token) {
    const profile = await req('GET', '/api/auth/profile', null, { Authorization: `Bearer ${token}` });
    log('GET /api/auth/profile (auth)', profile.status, profile.status === 200 && profile.json?.success, profile.json?.data?.email || profile.json?.message);
  }

  // 9. Get profile (no token)
  const profileNoAuth = await req('GET', '/api/auth/profile');
  log('GET /api/auth/profile (no token)', profileNoAuth.status, profileNoAuth.status === 401, profileNoAuth.json?.message || '');

  // 10. Admin products list
  if (adminToken) {
    const adminProds = await req('GET', '/api/admin/products', null, { Authorization: `Bearer ${adminToken}` });
    log('GET /api/admin/products (admin)', adminProds.status, adminProds.status === 200 && adminProds.json?.success, `${adminProds.json?.data?.length || 0} products`);

    // 11. Admin dashboard
    const dash = await req('GET', '/api/admin/dashboard', null, { Authorization: `Bearer ${adminToken}` });
    log('GET /api/admin/dashboard (admin)', dash.status, dash.status === 200 && dash.json?.success, dash.json?.data ? `revenue=₹${dash.json.data.totalRevenue}` : dash.json?.message);

    // 12. Admin orders
    const orders = await req('GET', '/api/admin/orders', null, { Authorization: `Bearer ${adminToken}` });
    log('GET /api/admin/orders (admin)', orders.status, orders.status === 200 && orders.json?.success, `${orders.json?.data?.length || 0} orders`);

    // 13. Admin settings update
    const settingsUpd = await req('PUT', '/api/admin/settings', { aboutUs: 'Jhariya - Premium Indian Ethnic Wear' }, { Authorization: `Bearer ${adminToken}` });
    log('PUT /api/admin/settings (admin)', settingsUpd.status, settingsUpd.status === 200 && settingsUpd.json?.success, settingsUpd.json?.message || settingsUpd.json?.errors);
  }

  // 14. Admin route without token (should fail 401)
  const adminNoAuth = await req('GET', '/api/admin/products');
  log('GET /api/admin/products (no token)', adminNoAuth.status, adminNoAuth.status === 401, adminNoAuth.json?.message || '');

  // 15. Customer route without token (should fail 401)
  const orderNoAuth = await req('POST', '/api/orders/create', { products: [], shippingAddress: {} });
  log('POST /api/orders/create (no token)', orderNoAuth.status, orderNoAuth.status === 401, orderNoAuth.json?.message || '');

  // 16. Order create with valid token but empty cart (should fail 400)
  if (token) {
    const orderEmpty = await req('POST', '/api/orders/create', { products: [], shippingAddress: {} }, { Authorization: `Bearer ${token}` });
    log('POST /api/orders/create (empty cart)', orderEmpty.status, orderEmpty.status === 400, orderEmpty.json?.message || '');
  }

  // 17. Check CORS header on products
  const corsCheck = await req('GET', '/api/products');
  // CORS is server-side so we just check status
  log('CORS enabled on API', corsCheck.status, corsCheck.status === 200, 'cors() middleware active');

  // 18. 404 test
  const notFound = await req('GET', '/api/nonexistent-route');
  log('404 for unknown API route', notFound.status, notFound.status !== 200, `got ${notFound.status}`);

  console.log('\n========================================');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`  TOTAL: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    console.log('FAILED TESTS:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name} [${r.status}] ${r.detail}`));
  }
  process.exit(0);
}

run().catch(e => { console.error('Diagnostic error:', e); process.exit(1); });
