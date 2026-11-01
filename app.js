/* ==========================================================================
   Jhariya E-Commerce Engine - Dynamic Owner Panel & localStorage Persistence
   ========================================================================== */

const API_BASE = (window.location.protocol === 'file:' || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.port)) ? 'http://localhost:5000' : '';

// 1. Initial State & Defaults (Clean, sequential templates with no descriptions or strike-through sales)
const DEFAULT_PRODUCTS_DB = [];

// 2. Reviews Testimonial Database (Customer Editable via /api/reviews)
let REVIEWS_DB = [];

// 3. Application State Variables
let PRODUCTS_DB = [];
let currentProducts = [];
let filteredProducts = [];
let cart = [];
let currentPage = 1;
const itemsPerPage = 10;
let activeSort = "featured";
let activeFilters = {
    sizes: [],
    priceRange: "all"
};
let activeSearchQuery = "";
let simulatedUser = null; // Manage user login states
let jhariyaAboutText = ""; // Dynamic brand description

// Initialize and Sync Product State with Backend APIs
async function loadProductsFromStorage() {
    try {
        const response = await fetch(API_BASE + '/api/products');
        const json = await response.json();
        if (json.success && json.data && json.data.products) {
            PRODUCTS_DB = json.data.products.map(p => {
                p.id = p._id; // Map Mongoose ID to id for frontend logic compatibility
                p.images = (Array.isArray(p.images) && p.images.length > 0) ? p.images : [p.image || "assets/logo.png"];
                p.image = p.images[0]; // Primary photo mapping
                p.wash = p.washCare || ''; // Align UI wash variable with database washCare field
                p.reviewsCount = p.reviewCount || 0; // Align UI reviewsCount with database reviewCount
                return p;
            });
            saveProductsToStorage();
            currentProducts = [...PRODUCTS_DB];
            filteredProducts = [...PRODUCTS_DB];
            return;
        }
    } catch (err) {
        console.error('Failed to load products from database:', err);
    }
    
    // Fallback to localStorage cache if network fails
    const localData = localStorage.getItem("jhariya_products");
    if (localData) {
        try {
            PRODUCTS_DB = JSON.parse(localData);
        } catch (e) {
            PRODUCTS_DB = [];
        }
    }
    currentProducts = [...PRODUCTS_DB];
    filteredProducts = [...PRODUCTS_DB];
}

async function loadSettings() {
    try {
        const response = await fetch(API_BASE + '/api/settings');
        const json = await response.json();
        if (json.success && json.data) {
            jhariyaAboutText = json.data.aboutUs || "";
            renderAboutText();
        }
    } catch (err) {
        console.error('Failed to load dynamic site settings:', err);
    }
}

function saveProductsToStorage() {
    localStorage.setItem("jhariya_products", JSON.stringify(PRODUCTS_DB));
}

// Persist and verify user session with live backend API
async function loadUserSession() {
    const token = localStorage.getItem("jhariya_token");
    if (token) {
        try {
            const res = await fetch(API_BASE + '/api/auth/profile', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success && json.data && json.data.user) {
                const user = json.data.user;
                simulatedUser = {
                    id: user._id,
                    name: user.fullName,
                    email: user.email,
                    role: user.role
                };
                saveUserSession();
                renderAccountDrawerState();
                return;
            }
        } catch (err) {
            console.error("Session token validation failed on load:", err);
        }
    }

    // Token missing or invalid/expired: purge stale session
    simulatedUser = null;
    localStorage.removeItem("jhariya_token");
    localStorage.removeItem("jhariya_user");
    renderAccountDrawerState();
}

function saveUserSession() {
    if (simulatedUser) {
        localStorage.setItem("jhariya_user", JSON.stringify(simulatedUser));
    } else {
        localStorage.removeItem("jhariya_user");
    }
}

function loadAboutTextFromStorage() {
    const stored = localStorage.getItem("jhariya_about_text");
    if (stored !== null) {
        jhariyaAboutText = stored;
    } else {
        // Fallback to blank space as requested
        jhariyaAboutText = "";
        localStorage.setItem("jhariya_about_text", jhariyaAboutText);
    }
    renderAboutText();
}

function renderAboutText() {
    const textEl = document.getElementById("about-us-text");
    if (textEl) {
        textEl.textContent = jhariyaAboutText;
    }
}

// 4. UI Initializer
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Initial State Loading from Backend APIs
    await loadProductsFromStorage();
    await loadReviewsFromStorage();
    await loadUserSession();
    await loadSettings();
    
    // 2. Setup Image Fail Backups
    initializeAssets();
    
    // 3. Setup Owner Panel & Review Modal Listeners
    setupAdminListeners();
    setupWriteReviewListeners();

    // 4. Render Layout Sections
    renderProducts();
    renderReviews();
    updateCartCount();

    // 5. Drawer Actions
    setupDrawerListeners();

    // 6. Filter actions
    setupToolbarListeners();

    // 7. Form submissions
    setupFormSubmitListeners();

    // 8. Policy accordions
    setupAccordionListeners();
});

function initializeAssets() {
    const productGrid = document.getElementById("product-grid");
    productGrid.addEventListener("error", (e) => {
        if(e.target.tagName === 'IMG') {
            e.target.style.display = 'none';
            e.target.parentElement.style.background = 'linear-gradient(135deg, #2D0B12 0%, #D4AF37 100%)';
        }
    }, true);
}

// 5. Render Core Product Catalogue Grid
function renderProducts() {
    const grid = document.getElementById("product-grid");
    grid.innerHTML = "";

    applyFiltersAndSorting();

    const totalItems = filteredProducts.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filteredProducts.slice(startIndex, endIndex);

    if (paginatedItems.length === 0) {
        grid.innerHTML = `
            <div class="empty-grid-msg" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <p style="font-size: 1.2rem; font-family: 'Playfair Display', serif; color: var(--brand-burgundy);">No matching Kurtis found.</p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">Try clearing filters or adjusting your search term.</p>
                <button class="dark-btn" onclick="clearAllFilters()" style="margin-top: 20px;">Clear All Filters</button>
            </div>
        `;
        renderPagination(totalPages);
        return;
    }

    paginatedItems.forEach(product => {
        const imgs = (Array.isArray(product.images) && product.images.length > 0) ? product.images : [product.image || "assets/logo.png"];
        const primaryImg = imgs[0];
        const secondaryImg = imgs.length > 1 ? imgs[1] : primaryImg;
        const photoBadge = imgs.length > 1 ? `<span class="photo-count-badge">📷 ${imgs.length} Photos</span>` : '';

        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <div class="product-image-box">
                ${photoBadge}
                <img src="${primaryImg}" alt="${product.title}" class="product-card-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'400\\' style=\\'background:%23F8F3E3;font-family:Playfair Display,serif;fill:%232D0B12;\\'><text x=\\'50%\\' y=\\'50%\\' font-size=\\'22\\' font-weight=\\'bold\\' text-anchor=\\'middle\\'>JHARIYA</text><text x=\\'50%\\' y=\\'58%\\' font-size=\\'12\\' font-family=\\'Montserrat\\' text-anchor=\\'middle\\' fill=\\'%23767676\\'>${escapeHTML(product.style)} Kurti</text></svg>'">
                <button class="quick-view-overlay" onclick="openDetailModal('${product.id}')">Quick View Details</button>
            </div>
            <div class="product-info-box">
                <span class="product-fabric">${product.fabric} • ${product.style}</span>
                <h3 class="product-title">${product.title}</h3>
                <div class="price-row">
                    <span style="color: var(--brand-burgundy)">₹${product.price.toLocaleString('en-IN')}</span>
                </div>
            </div>
        `;
        
        const cardImg = card.querySelector('.product-card-img');
        if (imgs.length > 1 && cardImg) {
            card.addEventListener('mouseenter', () => { cardImg.src = secondaryImg; });
            card.addEventListener('mouseleave', () => { cardImg.src = primaryImg; });
        }
        grid.appendChild(card);
    });

    renderPagination(totalPages);
}

function renderStars(rating) {
    let starsHTML = "";
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;
    
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            starsHTML += '<span class="star">★</span>';
        } else if (i === fullStars + 1 && hasHalf) {
            starsHTML += '<span class="star" style="opacity: 0.7">★</span>';
        } else {
            starsHTML += '<span class="star" style="color: #D6D6D6">★</span>';
        }
    }
    return starsHTML;
}

function renderPagination(totalPages) {
    const container = document.getElementById("pagination-pages");
    container.innerHTML = "";

    const prevBtn = document.getElementById("prev-page-btn");
    const nextBtn = document.getElementById("next-page-btn");

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;

    for (let i = 1; i <= totalPages; i++) {
        const dot = document.createElement("button");
        dot.className = `page-indicator ${i === currentPage ? 'active' : ''}`;
        dot.ariaLabel = `Go to Page ${i}`;
        dot.addEventListener("click", () => {
            currentPage = i;
            renderProducts();
            window.scrollTo({ top: document.querySelector('.toolbar-section').offsetTop - 90, behavior: 'smooth' });
        });
        container.appendChild(dot);
    }
}

// 6. Pagination Actions
document.getElementById("prev-page-btn").addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        renderProducts();
        window.scrollTo({ top: document.querySelector('.toolbar-section').offsetTop - 90, behavior: 'smooth' });
    }
});

document.getElementById("next-page-btn").addEventListener("click", () => {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
        window.scrollTo({ top: document.querySelector('.toolbar-section').offsetTop - 90, behavior: 'smooth' });
    }
});

// 7. Filtering & Sorting Logic
function applyFiltersAndSorting() {
    filteredProducts = PRODUCTS_DB.filter(product => {
        if (activeSearchQuery !== "") {
            const query = activeSearchQuery.toLowerCase();
            const matchesTitle = product.title.toLowerCase().includes(query);
            const matchesFabric = product.fabric.toLowerCase().includes(query);
            const matchesStyle = product.style.toLowerCase().includes(query);
            if (!matchesTitle && !matchesFabric && !matchesStyle) {
                return false;
            }
        }

        if (activeFilters.sizes.length > 0) {
            const hasSize = product.sizes.some(size => activeFilters.sizes.includes(size));
            if (!hasSize) return false;
        }

        if (activeFilters.priceRange !== "all") {
            const range = activeFilters.priceRange;
            if (range === "0-999" && product.price > 999) return false;
            if (range === "0-1499" && product.price > 1499) return false;
            if (range === "0-1999" && product.price > 1999) return false;
        }

        return true;
    });

    if (activeSort === "price-low") {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (activeSort === "price-high") {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (activeSort === "rating") {
        filteredProducts.sort((a, b) => b.rating - a.rating);
    } else if (activeSort === "newest") {
        filteredProducts.sort((a, b) => (b.newArrival ? 1 : 0) - (a.newArrival ? 1 : 0));
    } else {
        // Default: featured / bestseller
        filteredProducts.sort((a, b) => (b.bestseller ? 1 : 0) - (a.bestseller ? 1 : 0));
    }

    renderActiveBadges();
}

function renderActiveBadges() {
    const row = document.getElementById("active-filters-row");
    row.innerHTML = "";

    const addBadge = (text, type, value) => {
        const badge = document.createElement("div");
        badge.className = "active-filter-badge";
        badge.innerHTML = `
            <span>${text}</span>
            <button onclick="removeFilter('${type}', '${value}')">&times;</button>
        `;
        row.appendChild(badge);
    };

    activeFilters.sizes.forEach(sz => addBadge(`Size: ${sz}`, 'size', sz));
    if (activeFilters.priceRange !== "all") {
        let label = "";
        if (activeFilters.priceRange === "0-999") label = "Under ₹999";
        if (activeFilters.priceRange === "0-1499") label = "Under ₹1,499";
        if (activeFilters.priceRange === "0-1999") label = "Under ₹1,999";
        addBadge(label, 'priceRange', activeFilters.priceRange);
    }
    if (activeSearchQuery !== "") {
        addBadge(`Search: "${activeSearchQuery}"`, 'search', activeSearchQuery);
    }
}

window.removeFilter = function(type, value) {
    if (type === 'size') {
        activeFilters.sizes = activeFilters.sizes.filter(item => item !== value);
        const el = document.querySelector(`.size-filter-btn[data-size="${value}"]`);
        if (el) el.classList.remove("selected");
    } else if (type === 'priceRange') {
        activeFilters.priceRange = "all";
        const el = document.querySelector('.filter-panel input[name="price-range"][value="all"]');
        if (el) el.checked = true;
    } else if (type === 'search') {
        activeSearchQuery = "";
        document.getElementById("global-search-input").value = "";
    }

    currentPage = 1;
    renderProducts();
};

window.clearAllFilters = function() {
    activeFilters = { sizes: [], priceRange: "all" };
    activeSearchQuery = "";
    
    document.querySelectorAll('.size-filter-btn').forEach(b => b.classList.remove("selected"));
    const allRadio = document.querySelector('.filter-panel input[name="price-range"][value="all"]');
    if (allRadio) allRadio.checked = true;
    document.getElementById("global-search-input").value = "";

    currentPage = 1;
    renderProducts();
};

function setupToolbarListeners() {
    const filterToggle = document.getElementById("filter-toggle");
    const sortToggle = document.getElementById("sort-toggle");
    const filterPanel = document.getElementById("filter-panel");
    const sortPanel = document.getElementById("sort-panel");

    filterToggle.addEventListener("click", () => {
        sortPanel.classList.remove("open");
        filterPanel.classList.toggle("open");
    });

    sortToggle.addEventListener("click", () => {
        filterPanel.classList.remove("open");
        sortPanel.classList.toggle("open");
    });

    document.querySelectorAll(".size-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            btn.classList.toggle("selected");
        });
    });

    document.getElementById("clear-filters-btn").addEventListener("click", () => {
        clearAllFilters();
        filterPanel.classList.remove("open");
    });

    document.getElementById("apply-filters-btn").addEventListener("click", () => {
        activeFilters.sizes = Array.from(document.querySelectorAll('.size-filter-btn.selected')).map(b => b.dataset.size);
        
        const priceVal = document.querySelector('input[name="price-range"]:checked');
        activeFilters.priceRange = priceVal ? priceVal.value : "all";

        currentPage = 1;
        renderProducts();
        filterPanel.classList.remove("open");
    });

    document.querySelectorAll(".sort-options li").forEach(option => {
        option.addEventListener("click", () => {
            document.querySelectorAll(".sort-options li").forEach(li => li.classList.remove("active"));
            option.classList.add("active");
            activeSort = option.dataset.sort;
            currentPage = 1;
            renderProducts();
            sortPanel.classList.remove("open");
        });
    });
}

// 8. Shopping Bag / Cart Actions
window.updateCartCount = function() {
    const count = cart.reduce((total, item) => total + item.qty, 0);
    document.querySelectorAll(".cart-count").forEach(el => el.textContent = count);
    
    document.querySelectorAll(".cart-count").forEach(el => {
        if (count > 0) {
            el.style.display = "flex";
        } else {
            el.style.display = "none";
        }
    });
};

window.renderCartItems = function() {
    const container = document.getElementById("cart-items-container");
    const emptyState = document.getElementById("empty-cart-state");
    const footer = document.getElementById("cart-drawer-footer");

    container.innerHTML = "";

    if (cart.length === 0) {
        container.style.display = "none";
        emptyState.style.display = "flex";
        footer.style.display = "none";
        document.getElementById("subtotal-amount").textContent = "₹0";
        return;
    }

    container.style.display = "flex";
    emptyState.style.display = "none";
    footer.style.display = "block";

    let subtotal = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.product.price * item.qty;
        subtotal += itemTotal;

        const cartItemDiv = document.createElement("div");
        cartItemDiv.className = "cart-item";
        cartItemDiv.innerHTML = `
            <div class="cart-item-img-box">
                <img src="${item.product.image}" alt="${item.product.title}" class="cart-item-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'130\\' style=\\'background:%23F8F3E3;font-family:Playfair Display,serif;fill:%232D0B12;\\'><text x=\\'50%\\' y=\\'50%\\' font-size=\\'12\\' font-weight=\\'bold\\' text-anchor=\\'middle\\'>JHARIYA</text></svg>'">
            </div>
            <div class="cart-item-details">
                <h4 class="cart-item-title">${item.product.title}</h4>
                <div class="cart-item-meta">Size: <strong>${item.size}</strong> | ${item.product.fabric}</div>
                <div class="cart-item-price-row">
                    <div class="qty-counter">
                        <button class="qty-btn" onclick="updateCartQty(${index}, -1)">-</button>
                        <span class="qty-val">${item.qty}</span>
                        <button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
                    </div>
                    <span class="cart-item-price">₹${itemTotal.toLocaleString('en-IN')}</span>
                </div>
                <button class="remove-item-btn" onclick="removeCartItem(${index})" style="align-self: flex-start; margin-top: 10px;">Remove</button>
            </div>
        `;
        container.appendChild(cartItemDiv);
    });

    document.getElementById("subtotal-amount").textContent = `₹${subtotal.toLocaleString('en-IN')}`;

    const shippingNoticeEl = document.querySelector(".shipping-notice");
    if (shippingNoticeEl) {
        if (subtotal >= 2000) {
            shippingNoticeEl.innerHTML = `🎉 <strong>Congratulations!</strong> You qualify for <strong>FREE Delivery</strong>!`;
            shippingNoticeEl.style.color = "#1b7a42";
        } else {
            const needed = 2000 - subtotal;
            shippingNoticeEl.innerHTML = `🚚 Add <strong>₹${needed.toLocaleString('en-IN')}</strong> more to unlock <strong>FREE Delivery</strong>! (Flat ₹99 below ₹2,000)`;
            shippingNoticeEl.style.color = "var(--text-muted)";
        }
    }
};

window.addToCart = function(productId, size) {
    const product = PRODUCTS_DB.find(p => p.id === productId);
    if (!product) return;

    if (!size) {
        alert("Please select a size first.");
        return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === productId && item.size === size);
    if (existingIndex > -1) {
        cart[existingIndex].qty++;
    } else {
        cart.push({ product, size, qty: 1 });
    }

    updateCartCount();
    renderCartItems();
    openDrawer("cart-drawer-overlay", "cart-drawer");
};

window.updateCartQty = function(index, delta) {
    if (index < 0 || index >= cart.length) return;
    
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }

    updateCartCount();
    renderCartItems();
};

window.removeCartItem = function(index) {
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    
    updateCartCount();
    renderCartItems();
};

// 9. Drawer & Modal Actions
function openDrawer(overlayId, drawerId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeDrawer(overlayId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.remove("open");
    document.body.style.overflow = "";
}

window.openTrackOrderModal = function(initialId = "") {
    const overlay = document.getElementById("track-modal-overlay");
    const input = document.getElementById("modal-track-input");
    const resultBox = document.getElementById("modal-track-result");
    const recentBox = document.getElementById("modal-track-recent");

    overlay.classList.add("open");
    document.body.style.overflow = "hidden";

    if (simulatedUser && simulatedUser.orders && simulatedUser.orders.length > 0) {
        let recentHtml = `<p>📦 Your Recent Orders:</p>`;
        simulatedUser.orders.slice(0, 3).forEach(o => {
            const trkId = o.trackingId || o.id || o._id;
            recentHtml += `<button type="button" class="recent-order-pill" onclick="trackOrderQuickFill('${escapeHTML(trkId)}')">🏷️ ${escapeHTML(trkId)} (${escapeHTML(o.orderStatus || 'Processing')})</button>`;
        });
        recentBox.innerHTML = recentHtml;
        recentBox.classList.remove("hidden");
    } else {
        recentBox.classList.add("hidden");
    }

    if (initialId) {
        input.value = initialId;
        renderTrackResult(initialId, resultBox);
    } else {
        input.focus();
    }
};

window.closeTrackOrderModal = function() {
    const overlay = document.getElementById("track-modal-overlay");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
};

window.saveOrderToLocalHistory = function(orderRecord) {
    try {
        let history = JSON.parse(localStorage.getItem("jhariya_my_orders") || "[]");
        const existingIdx = history.findIndex(o => (o.trackingId && orderRecord.trackingId && o.trackingId === orderRecord.trackingId) || (o._id && orderRecord._id && o._id === orderRecord._id));
        if (existingIdx === -1) {
            history.unshift(orderRecord);
        } else {
            history[existingIdx] = orderRecord;
        }
        localStorage.setItem("jhariya_my_orders", JSON.stringify(history));

        if (simulatedUser) {
            if (!simulatedUser.orders) simulatedUser.orders = [];
            const userIdx = simulatedUser.orders.findIndex(o => (o.trackingId && orderRecord.trackingId && o.trackingId === orderRecord.trackingId) || (o._id && orderRecord._id && o._id === orderRecord._id));
            if (userIdx === -1) simulatedUser.orders.unshift(orderRecord);
            else simulatedUser.orders[userIdx] = orderRecord;
            saveUserSession();
        }
    } catch (e) {
        console.error('Failed to save order to local history:', e);
    }
};

window.openOrderHistoryModal = async function() {
    const token = localStorage.getItem("jhariya_token");
    const overlay = document.getElementById("order-history-modal-overlay");
    const container = document.getElementById("order-history-list-container");
    if (!overlay || !container) return;

    overlay.classList.add("open");
    document.body.style.overflow = "hidden";

    container.innerHTML = `
        <div style="text-align:center; padding: 40px 20px;">
            <p style="font-family:'Montserrat',sans-serif; color:var(--text-muted);">⏳ Fetching your order history...</p>
        </div>
    `;

    let allOrders = [];

    // Read local history
    try {
        const localHistory = JSON.parse(localStorage.getItem("jhariya_my_orders") || "[]");
        if (Array.isArray(localHistory)) {
            allOrders = [...localHistory];
        }
    } catch (e) {}

    // Fetch from backend API if logged in
    if (token) {
        try {
            const response = await fetch(API_BASE + '/api/orders/my-orders', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const json = await response.json();

            if (json.success && Array.isArray(json.data)) {
                json.data.forEach(apiOrder => {
                    const trkId = apiOrder.trackingId || apiOrder._id;
                    const idx = allOrders.findIndex(o => (o.trackingId && o.trackingId === trkId) || (o._id && o._id === apiOrder._id));
                    if (idx === -1) {
                        allOrders.push(apiOrder);
                    } else {
                        allOrders[idx] = apiOrder;
                    }
                });
            }
        } catch (err) {
            console.error('API fetch error for my-orders:', err);
        }
    }

    // Sort by createdAt descending
    allOrders.sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()));

    if (allOrders.length > 0) {
        let html = '';
        allOrders.forEach(order => {
            const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const trkId = order.trackingId || order._id || 'JH-2026-UNKNOWN';
            const statusBadge = (order.orderStatus || 'processing').toUpperCase();
            const payMethod = order.paymentMethod || (order.razorpayOrderId ? 'Online' : 'COD');
            const isPaid = order.paymentStatus === 'paid';

            let itemsHtml = '';
            if (Array.isArray(order.products)) {
                order.products.forEach(item => {
                    const p = item.product || {};
                    const title = p.title || 'Designer Kurti';
                    const img = (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : (p.image || 'assets/logo.png');
                    itemsHtml += `
                        <div style="display:flex; gap:12px; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border-color);">
                            <img src="${img}" width="48" height="60" style="object-fit:cover; border-radius:4px; background:#F8F3E3;" onerror="this.src='assets/logo.png'">
                            <div style="flex:1;">
                                <h5 style="margin:0 0 4px 0; font-size:0.85rem; font-family:'Montserrat'; font-weight:600;">${escapeHTML(title)}</h5>
                                <span style="font-size:0.75rem; color:var(--text-muted);">Size: <strong>${escapeHTML(item.size || 'M')}</strong> • Qty: ${item.quantity}</span>
                            </div>
                            <span style="font-size:0.85rem; font-weight:600; color:var(--brand-burgundy);">₹${((item.price || 0) * item.quantity).toLocaleString('en-IN')}</span>
                        </div>
                    `;
                });
            }

            html += `
                <div style="border:1.5px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:16px; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.04);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
                        <div>
                            <strong style="font-size:0.9rem; color:var(--brand-burgundy); font-family:'Playfair Display',serif;">Order #${escapeHTML(trkId)}</strong>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">📅 ${dateStr}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:700; background:var(--brand-burgundy); color:#fff;">${statusBadge}</span>
                            <div style="font-size:0.72rem; color:var(--text-dark); margin-top:4px;">${payMethod} • <span style="color:${isPaid ? '#1b7a42' : '#b8860b'}; font-weight:600;">${isPaid ? 'Paid' : 'Pay on Delivery'}</span></div>
                        </div>
                    </div>
                    <div style="margin-bottom:12px;">
                        ${itemsHtml}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px;">
                        <span style="font-size:0.9rem; font-weight:700; color:var(--brand-burgundy);">Total: ₹${(order.total || 0).toLocaleString('en-IN')}</span>
                        <button onclick="closeOrderHistoryModal(); openTrackOrderModal('${escapeHTML(trkId)}');" style="background:var(--brand-gold-pale); border:1px solid var(--brand-gold); color:var(--brand-burgundy); padding:6px 12px; font-size:0.75rem; font-weight:600; border-radius:4px; cursor:pointer; font-family:'Montserrat';">Track Status 📦</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <div style="font-size: 2.5rem; margin-bottom: 10px;">🛍️</div>
                <p style="font-family:'Playfair Display',serif; font-size:1.1rem; color:var(--brand-burgundy); margin:0;">No orders found</p>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">You haven't placed any orders yet.</p>
            </div>
        `;
    }
};

window.closeOrderHistoryModal = function() {
    const overlay = document.getElementById("order-history-modal-overlay");
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";
};

window.trackOrderQuickFill = function(trkId) {
    const input = document.getElementById("modal-track-input");
    input.value = trkId;
    renderTrackResult(trkId, document.getElementById("modal-track-result"));
};

function renderTrackResult(trackingId, resultBox) {
    const cleanId = trackingId.trim().toUpperCase();
    if (!cleanId) {
        resultBox.classList.remove("hidden");
        resultBox.innerHTML = `<div style="color:var(--brand-burgundy); font-weight:600; font-size:0.85rem; padding: 10px;">⚠️ Please enter a valid Order ID or AWB Tracking Number.</div>`;
        return;
    }

    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `
        <div class="track-status-card">
            <div class="track-header-meta">
                <div>
                    <div class="track-order-id">Order #${escapeHTML(cleanId)}</div>
                    <div class="track-courier-tag">Express Courier • AWB #9842${cleanId.replace(/\D/g, '') || '71029'}</div>
                </div>
                <span class="status-badge in-transit">IN TRANSIT</span>
            </div>
            
            <div style="font-size: 0.82rem; color: #444; margin-bottom: 14px; line-height: 1.4;">
                📍 <strong>Current Location:</strong> In Transit (Regional Facility)<br>
                📅 <strong>Expected Delivery:</strong> Within 10 Days of Order Placement
            </div>

            <div class="track-timeline">
                <div class="timeline-step completed">
                    <div class="step-marker"></div>
                    <div class="step-title">Order Placed & QC Verified</div>
                    <div class="step-desc">Item passed quality checks</div>
                    <div class="step-time">Yesterday, 10:30 AM</div>
                </div>
                <div class="timeline-step completed">
                    <div class="step-marker"></div>
                    <div class="step-title">Dispatched & Handled with Care</div>
                    <div class="step-desc">Handled with specialized protective packaging</div>
                    <div class="step-time">Yesterday, 04:15 PM</div>
                </div>
                <div class="timeline-step active">
                    <div class="step-marker"></div>
                    <div class="step-title">In Transit - Regional Facility</div>
                    <div class="step-desc">Arrived at sorting facility. En route to destination.</div>
                    <div class="step-time">Today, 06:45 AM</div>
                </div>
                <div class="timeline-step">
                    <div class="step-marker"></div>
                    <div class="step-title">Out for Delivery</div>
                    <div class="step-desc">Assigned to local delivery agent</div>
                    <div class="step-time">Pending</div>
                </div>
                <div class="timeline-step">
                    <div class="step-marker"></div>
                    <div class="step-title">Delivered</div>
                    <div class="step-desc">Package handed to recipient</div>
                    <div class="step-time">Pending</div>
                </div>
            </div>
        </div>
    `;
}

function setupDrawerListeners() {
    document.getElementById("hamburger-menu").addEventListener("click", () => openDrawer("menu-drawer-overlay", "menu-drawer"));
    document.querySelector("#menu-drawer-overlay .close-drawer-btn").addEventListener("click", () => closeDrawer("menu-drawer-overlay"));
    document.getElementById("menu-drawer-overlay").addEventListener("click", (e) => {
        if (e.target.id === "menu-drawer-overlay") closeDrawer("menu-drawer-overlay");
    });

    document.getElementById("account-btn").addEventListener("click", () => {
        openDrawer("account-drawer-overlay", "account-drawer");
        renderAccountDrawerState();
    });
    document.querySelector("#account-drawer-overlay .close-drawer-btn").addEventListener("click", () => closeDrawer("account-drawer-overlay"));
    document.getElementById("account-drawer-overlay").addEventListener("click", (e) => {
        if (e.target.id === "account-drawer-overlay") closeDrawer("account-drawer-overlay");
    });

    document.getElementById("cart-btn").addEventListener("click", () => {
        openDrawer("cart-drawer-overlay", "cart-drawer");
        renderCartItems();
    });
    document.querySelector("#cart-drawer-overlay .close-drawer-btn").addEventListener("click", () => closeDrawer("cart-drawer-overlay"));

    // Track Order Modal listeners
    const trackModalBtn = document.getElementById("close-track-modal-btn");
    if (trackModalBtn) {
        trackModalBtn.addEventListener("click", closeTrackOrderModal);
    }
    const trackOverlay = document.getElementById("track-modal-overlay");
    if (trackOverlay) {
        trackOverlay.addEventListener("click", (e) => {
            if (e.target.id === "track-modal-overlay") closeTrackOrderModal();
        });
    }

    // Order History Modal listeners
    const orderHistoryBtn = document.getElementById("open-order-history-btn");
    if (orderHistoryBtn) {
        orderHistoryBtn.addEventListener("click", (e) => {
            e.preventDefault();
            closeDrawer("account-drawer-overlay");
            openOrderHistoryModal();
        });
    }
    const closeOrderHistoryBtn = document.getElementById("close-order-history-modal-btn");
    if (closeOrderHistoryBtn) {
        closeOrderHistoryBtn.addEventListener("click", closeOrderHistoryModal);
    }
    const orderHistoryOverlay = document.getElementById("order-history-modal-overlay");
    if (orderHistoryOverlay) {
        orderHistoryOverlay.addEventListener("click", (e) => {
            if (e.target.id === "order-history-modal-overlay") closeOrderHistoryModal();
        });
    }
    document.getElementById("cart-drawer-overlay").addEventListener("click", (e) => {
        if (e.target.id === "cart-drawer-overlay") closeDrawer("cart-drawer-overlay");
    });
    document.querySelector(".start-shopping-btn").addEventListener("click", () => closeDrawer("cart-drawer-overlay"));

    const searchOverlay = document.getElementById("search-overlay");
    document.getElementById("search-btn").addEventListener("click", () => {
        searchOverlay.classList.add("open");
        document.getElementById("global-search-input").focus();
        document.body.style.overflow = "hidden";
    });
    document.getElementById("close-search-btn").addEventListener("click", () => {
        searchOverlay.classList.remove("open");
        document.body.style.overflow = "";
    });

    const searchInput = document.getElementById("global-search-input");
    searchInput.addEventListener("input", (e) => {
        const val = e.target.value;
        activeSearchQuery = val;
        currentPage = 1;
        
        const resultsBox = document.getElementById("search-results-block");
        resultsBox.innerHTML = "";

        if (val.trim() === "") {
            return;
        }

        const matches = PRODUCTS_DB.filter(p => 
            p.title.toLowerCase().includes(val.toLowerCase()) ||
            p.fabric.toLowerCase().includes(val.toLowerCase()) ||
            p.style.toLowerCase().includes(val.toLowerCase())
        ).slice(0, 4);

        if(matches.length === 0) {
            resultsBox.innerHTML = `<p style="font-size:0.9rem; color:var(--text-muted)">No designs match "${escapeHTML(val)}".</p>`;
            return;
        }

        const resultsGrid = document.createElement("div");
        resultsGrid.className = "mini-search-results-grid";
        matches.forEach(p => {
            const card = document.createElement("div");
            card.className = "mini-result-item";
            card.style.display = "flex";
            card.style.gap = "12px";
            card.style.cursor = "pointer";
            card.style.padding = "10px 0";
            card.style.borderBottom = "1px solid var(--border-color)";
            card.innerHTML = `
                <img src="${p.image}" width="50" height="65" style="object-fit:cover;background:#F8F3E3" onerror="this.src='data:image/svg+xml;utf8,<svg width=\\'50\\' height=\\'65\\' style=\\'background:%23F8F3E3;\\'></svg>'">
                <div>
                    <h6 style="font-size:0.85rem; font-weight:500; margin-bottom:2px; font-family:'Montserrat'">${p.title}</h6>
                    <span style="font-size:0.75rem; color:var(--brand-burgundy); font-weight:600">₹${p.price}</span>
                </div>
            `;
            card.addEventListener("click", () => {
                searchOverlay.classList.remove("open");
                document.body.style.overflow = "";
                openDetailModal(p.id);
            });
            resultsGrid.appendChild(card);
        });
        resultsBox.appendChild(resultsGrid);
    });

    document.getElementById("search-form").addEventListener("submit", (e) => {
        e.preventDefault();
        currentPage = 1;
        renderProducts();
        searchOverlay.classList.remove("open");
        document.body.style.overflow = "";
        window.scrollTo({ top: document.querySelector('.toolbar-section').offsetTop - 90, behavior: 'smooth' });
    });

    document.querySelector(".drawer-dropdown-title").addEventListener("click", function() {
        this.classList.toggle("active");
    });

    document.querySelectorAll(".drawer-submenu-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const filterType = link.dataset.filter;
            const filterVal = link.dataset.val;

            clearAllFilters();
            if (filterType === 'Style') {
                activeFilters.styles.push(filterVal);
                const el = document.querySelector(`.filter-panel input[value="${filterVal}"]`);
                if (el) el.checked = true;
            }

            currentPage = 1;
            renderProducts();
            closeDrawer("menu-drawer-overlay");
            window.scrollTo({ top: document.querySelector('.toolbar-section').offsetTop - 90, behavior: 'smooth' });
        });
    });

    document.querySelectorAll(".drawer-link").forEach(link => {
        link.addEventListener("click", (e) => {
            const scrollId = link.dataset.scroll;
            const sortTrigger = link.dataset.sortTrigger;

            if (scrollId) {
                e.preventDefault();
                closeDrawer("menu-drawer-overlay");
                if (scrollId === "track-order") {
                    openTrackOrderModal();
                    return;
                }
                const target = document.getElementById(scrollId);
                if (target) {
                    setTimeout(() => {
                        target.scrollIntoView({ behavior: "smooth" });
                    }, 350);
                }
            }

            if (sortTrigger) {
                e.preventDefault();
                closeDrawer("menu-drawer-overlay");
                activeSort = sortTrigger;
                document.querySelectorAll(".sort-options li").forEach(li => {
                    if (li.dataset.sort === sortTrigger) {
                        li.classList.add("active");
                    } else {
                        li.classList.remove("active");
                    }
                });
                currentPage = 1;
                renderProducts();
                window.scrollTo({ top: document.querySelector('.toolbar-section').offsetTop - 90, behavior: 'smooth' });
            }
        });
    });

    document.querySelectorAll(".scroll-trigger").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const href = link.getAttribute("href");
            if (href === "#track-order") {
                openTrackOrderModal();
                return;
            }
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });
}

// 10. Detail Quick View Modal Actions
window.openDetailModal = function(productId) {
    const product = PRODUCTS_DB.find(p => p.id === productId);
    if (!product) return;

    const overlay = document.getElementById("detail-modal-overlay");
    const container = document.getElementById("modal-detail-content");

    const productImages = (Array.isArray(product.images) && product.images.length > 0)
        ? product.images
        : [product.image || "assets/logo.png"];

    let activeImgIdx = 0;

    const renderMediaPanel = () => `
        <div class="modal-media-panel">
            <div class="main-image-viewport" style="position: relative; overflow: hidden; border-radius: 8px;">
                <img id="main-modal-view" src="${productImages[activeImgIdx]}" alt="${product.title}" style="width: 100%; display: block; object-fit: contain; background: var(--brand-gold-pale); transition: opacity 0.2s ease;">
                ${productImages.length > 1 ? `
                <button id="modal-prev-img" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.85); border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: var(--brand-burgundy); box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 5;">‹</button>
                <button id="modal-next-img" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.85); border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: var(--brand-burgundy); box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 5;">›</button>
                ` : ''}
            </div>
            ${productImages.length > 1 ? `
            <div class="gallery-thumb-container">
                ${productImages.map((img, idx) => `
                    <div class="gallery-thumb-item ${idx === activeImgIdx ? 'active' : ''}" data-idx="${idx}">
                        <img src="${img}" alt="View ${idx + 1}">
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
    `;

    container.innerHTML = `
        ${renderMediaPanel()}
        <div class="modal-info-panel">
            <span class="product-fabric">${product.fabric || "Not specified"} • Handloom</span>
            <h2>${product.title}</h2>
            <div class="rating-stars">
                ${renderStars(product.rating)}
                <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600">(${product.reviewsCount} verified purchases)</span>
            </div>
            <div class="modal-price-row">
                <span>₹${product.price}</span>
            </div>
            
            <p class="modal-description" style="font-size:0.85rem; color:var(--text-muted); margin: 15px 0; line-height: 1.5; font-family: Montserrat;">${product.description || "Not specified"}</p>
            
            <div class="size-selector-block">
                <div class="size-selector-header">
                    <span>Select Size (Chest size in inches)</span>
                    <a href="#" style="text-decoration:underline; font-size:0.7rem; color:var(--brand-burgundy)" onclick="showSizeChart(event)">Size Guide</a>
                </div>
                <div class="size-selector-btn-row">
                    ${product.sizes.map(size => `<button class="size-btn" data-modal-size="${size}">${size}</button>`).join('')}
                </div>
            </div>

            <button class="dark-btn block-btn" id="modal-add-to-cart-btn" style="padding: 16px 20px; font-size: 0.95rem;">Add To Shopping Bag</button>
            
            <ul class="detail-specs-list">
                <li><strong>Silhouette:</strong> <span>${product.style || "Not specified"}</span></li>
                <li><strong>Fabric Details:</strong> <span>${product.fabric || "Not specified"}</span></li>
                <li><strong>Length:</strong> <span>${product.length || (product.specs && product.specs.length) || "Not specified"}</span></li>
                <li><strong>Neck:</strong> <span>${product.neck || (product.specs && product.specs.neck) || "Not specified"}</span></li>
                <li><strong>Sleeve:</strong> <span>${product.sleeve || (product.specs && product.specs.sleeve) || "Not specified"}</span></li>
                <li><strong>Fit:</strong> <span>${product.fit || (product.specs && product.specs.fit) || "Not specified"}</span></li>
                <li><strong>Wash:</strong> <span>${product.wash || product.washCare || (product.specs && (product.specs.wash || product.specs.washCare)) || "Not specified"}</span></li>
                <li><strong>Embroidery:</strong> <span>${product.embroidery || (product.specs && product.specs.embroidery) || "Not specified"}</span></li>
                <li><strong>Color:</strong> <span>${product.color || (product.specs && product.specs.color) || "Not specified"}</span></li>
            </ul>
        </div>
    `;

    const updateGalleryView = (newIdx) => {
        if (newIdx < 0) newIdx = productImages.length - 1;
        if (newIdx >= productImages.length) newIdx = 0;
        activeImgIdx = newIdx;
        const mainImg = container.querySelector('#main-modal-view');
        if (mainImg) {
            mainImg.style.opacity = '0.4';
            setTimeout(() => {
                mainImg.src = productImages[activeImgIdx];
                mainImg.style.opacity = '1';
            }, 100);
        }
        container.querySelectorAll('.gallery-thumb-item').forEach((item, idx) => {
            if (idx === activeImgIdx) item.classList.add('active');
            else item.classList.remove('active');
        });
    };

    if (productImages.length > 1) {
        const prevBtn = container.querySelector('#modal-prev-img');
        const nextBtn = container.querySelector('#modal-next-img');
        if (prevBtn) prevBtn.addEventListener('click', () => updateGalleryView(activeImgIdx - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => updateGalleryView(activeImgIdx + 1));

        container.querySelectorAll('.gallery-thumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.idx);
                updateGalleryView(idx);
            });
        });
    }

    overlay.classList.add("open");
    document.body.style.overflow = "hidden";

    let selectedModalSize = null;
    const sizeBtns = container.querySelectorAll(".size-btn");
    sizeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            sizeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedModalSize = btn.dataset.modalSize;
        });
    });

    container.querySelector("#modal-add-to-cart-btn").addEventListener("click", () => {
        if (!selectedModalSize) {
            alert("Please select your size before adding to bag.");
            return;
        }
        addToCart(product.id, selectedModalSize);
        overlay.classList.remove("open");
        document.body.style.overflow = "";
    });
};

document.querySelector("#detail-modal-overlay .close-modal-btn").addEventListener("click", () => {
    document.getElementById("detail-modal-overlay").classList.remove("open");
    document.body.style.overflow = "";
});
document.getElementById("detail-modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "detail-modal-overlay") {
        document.getElementById("detail-modal-overlay").classList.remove("open");
        document.body.style.overflow = "";
    }
});

// 11. Dynamic Testimonials Review Carousel Logic & Persistence
async function loadReviewsFromStorage() {
    try {
        const response = await fetch(API_BASE + '/api/reviews');
        const json = await response.json();
        if (json.success && Array.isArray(json.data)) {
            REVIEWS_DB = json.data;
            return;
        }
    } catch (err) {
        console.error('Failed to load customer reviews:', err);
    }
    REVIEWS_DB = [];
}

let activeReviewIndex = 0;
let reviewInterval = null;

function renderReviews() {
    const carousel = document.getElementById("reviews-carousel");
    const dotsContainer = document.getElementById("reviews-dots");
    if (!carousel || !dotsContainer) return;
    
    carousel.innerHTML = "";
    dotsContainer.innerHTML = "";

    if (REVIEWS_DB.length === 0) {
        carousel.innerHTML = `
            <div class="empty-reviews-state" style="text-align:center; padding: 40px 20px;">
                <p style="font-family: 'Playfair Display', serif; font-size: 1.15rem; color: var(--brand-burgundy); margin: 0;">No customer reviews yet.</p>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">Be the first to share your experience with Jhariya!</p>
            </div>
        `;
        return;
    }

    REVIEWS_DB.forEach((rev, index) => {
        const slide = document.createElement("div");
        slide.className = `review-slide ${index === activeReviewIndex ? 'active' : ''}`;
        
        const photoHTML = rev.photo 
            ? `<div class="review-photo-box" style="width:72px; height:72px; border-radius:50%; overflow:hidden; margin: 0 auto 14px auto; border:2px solid var(--brand-gold); box-shadow:0 4px 12px rgba(0,0,0,0.12);"><img src="${rev.photo}" alt="${escapeHTML(rev.name)}" style="width:100%; height:100%; object-fit:cover;"></div>` 
            : `<div class="review-avatar-circle" style="width:54px; height:54px; border-radius:50%; background:var(--brand-burgundy); color:var(--brand-gold-pale); font-family:'Playfair Display',serif; font-size:1.4rem; font-weight:bold; display:flex; align-items:center; justify-content:center; margin: 0 auto 12px auto;">${escapeHTML((rev.name || 'G').charAt(0).toUpperCase())}</div>`;

        slide.innerHTML = `
            ${photoHTML}
            <div class="rating-stars" style="justify-content:center; margin-bottom:12px;">
                ${renderStars(rev.rating)}
            </div>
            <p class="review-quote">"${escapeHTML(rev.quote)}"</p>
            <div class="review-author">
                <span>${escapeHTML(rev.name)}</span>
                ${rev.verified ? `<span class="verified-stamp">✓ Verified Purchase</span>` : ''}
            </div>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-top:6px; display:block;">Reviewed in ${escapeHTML(rev.date || 'Recent')}</span>
        `;
        carousel.appendChild(slide);

        const dot = document.createElement("button");
        dot.className = `review-dot ${index === activeReviewIndex ? 'active' : ''}`;
        dot.ariaLabel = `See Review ${index + 1}`;
        dot.addEventListener("click", () => {
            gotoReview(index);
            resetReviewTimer();
        });
        dotsContainer.appendChild(dot);
    });

    startReviewTimer();
}

function setupWriteReviewListeners() {
    const openBtn = document.getElementById("open-write-review-btn");
    const overlay = document.getElementById("write-review-modal-overlay");
    const closeBtn = document.querySelector("#write-review-modal-overlay .close-review-modal-btn");
    const form = document.getElementById("write-review-form");
    const photoZone = document.getElementById("review-photo-upload-zone");
    const photoInput = document.getElementById("review-photo-file");
    const photoPreview = document.getElementById("review-photo-preview");
    const photoPreviewImg = document.getElementById("review-photo-preview-img");
    const removePhotoBtn = document.getElementById("remove-review-photo-btn");
    const starPickerItems = document.querySelectorAll(".star-picker-item");
    const ratingInput = document.getElementById("review-rating-val");

    let uploadedReviewPhotoUrl = "";

    if (!openBtn || !overlay) return;

    openBtn.addEventListener("click", () => {
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
        if (simulatedUser && simulatedUser.name) {
            const nameInput = document.getElementById("review-customer-name");
            if (nameInput) nameInput.value = simulatedUser.name;
        }
    });

    const closeReviewModal = () => {
        overlay.classList.remove("open");
        document.body.style.overflow = "";
    };

    if (closeBtn) closeBtn.addEventListener("click", closeReviewModal);
    overlay.addEventListener("click", (e) => {
        if (e.target.id === "write-review-modal-overlay") closeReviewModal();
    });

    // Star Rating Picker
    starPickerItems.forEach(item => {
        item.addEventListener("click", () => {
            const val = parseInt(item.dataset.val);
            ratingInput.value = val;
            starPickerItems.forEach(s => {
                const sVal = parseInt(s.dataset.val);
                if (sVal <= val) {
                    s.style.color = "var(--brand-gold)";
                    s.classList.add("active");
                } else {
                    s.style.color = "#D6D6D6";
                    s.classList.remove("active");
                }
            });
        });
    });

    // Customer Photo Upload
    if (photoZone && photoInput) {
        photoZone.addEventListener("click", () => photoInput.click());
        photoInput.addEventListener("change", async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const formData = new FormData();
                formData.append("photo", file);

                const prompt = document.getElementById("review-photo-prompt");
                if (prompt) prompt.textContent = "⏳ Uploading photo...";

                try {
                    const res = await fetch(API_BASE + '/api/reviews/upload-photo', {
                        method: 'POST',
                        body: formData
                    });
                    const json = await res.json();
                    if (json.success && json.data) {
                        uploadedReviewPhotoUrl = json.data;
                        photoPreviewImg.src = uploadedReviewPhotoUrl;
                        photoPreview.style.display = "flex";
                        photoZone.style.display = "none";
                    } else {
                        alert("Photo upload failed: " + (json.message || "Unknown error"));
                    }
                } catch (err) {
                    console.error(err);
                    alert("Could not upload photo. Check connection.");
                } finally {
                    if (prompt) prompt.textContent = "Click to upload your outfit photo";
                }
            }
        });
    }

    if (removePhotoBtn) {
        removePhotoBtn.addEventListener("click", () => {
            uploadedReviewPhotoUrl = "";
            photoInput.value = "";
            photoPreview.style.display = "none";
            photoZone.style.display = "block";
        });
    }

    // Submit Review Form
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("review-customer-name").value.trim();
            const quote = document.getElementById("review-quote-input").value.trim();
            const rating = parseInt(ratingInput.value) || 5;

            if (!name || !quote) {
                alert("Please enter your name and review quote.");
                return;
            }

            try {
                const res = await fetch(API_BASE + '/api/reviews', {
                    method: 'POST',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name,
                        rating,
                        quote,
                        photo: uploadedReviewPhotoUrl
                    })
                });
                const json = await res.json();
                if (json.success) {
                    alert("Thank you! Your review has been submitted. ✨");
                    form.reset();
                    uploadedReviewPhotoUrl = "";
                    photoPreview.style.display = "none";
                    photoZone.style.display = "block";
                    closeReviewModal();

                    await loadReviewsFromStorage();
                    activeReviewIndex = 0;
                    renderReviews();
                } else {
                    alert("Review submission failed: " + (json.message || "Unknown error"));
                }
            } catch (err) {
                console.error(err);
                alert("Could not submit review. Please try again.");
            }
        });
    }
}

function gotoReview(index) {
    const slides = document.querySelectorAll(".review-slide");
    const dots = document.querySelectorAll(".review-dot");

    slides[activeReviewIndex].classList.remove("active");
    dots[activeReviewIndex].classList.remove("active");

    activeReviewIndex = index;
    if (activeReviewIndex >= REVIEWS_DB.length) activeReviewIndex = 0;
    if (activeReviewIndex < 0) activeReviewIndex = REVIEWS_DB.length - 1;

    slides[activeReviewIndex].classList.add("active");
    dots[activeReviewIndex].classList.add("active");
}

function startReviewTimer() {
    reviewInterval = setInterval(() => {
        gotoReview(activeReviewIndex + 1);
    }, 6000);
}

function resetReviewTimer() {
    clearInterval(reviewInterval);
    startReviewTimer();
}

document.querySelector(".prev-review").addEventListener("click", () => {
    gotoReview(activeReviewIndex - 1);
    resetReviewTimer();
});

document.querySelector(".next-review").addEventListener("click", () => {
    gotoReview(activeReviewIndex + 1);
    resetReviewTimer();
});

// 12. Simulated Authentication State Controller (Pre-wired for secure Jhariya Admin Portal)
function renderAccountDrawerState() {
    const loginBlock = document.getElementById("login-form-block");
    const signupBlock = document.getElementById("signup-form-block");
    const profileBlock = document.getElementById("user-profile-block");

    if (simulatedUser) {
        loginBlock.classList.add("hidden");
        signupBlock.classList.add("hidden");
        profileBlock.classList.remove("hidden");
        document.getElementById("user-display-name").textContent = simulatedUser.name;
        document.getElementById("user-display-email").textContent = simulatedUser.email;
        document.querySelector(".profile-avatar").textContent = simulatedUser.name.charAt(0).toUpperCase();
        
        const adminLi = document.getElementById("admin-panel-link-li");
        if (simulatedUser.role === "admin") {
            adminLi.classList.remove("hidden");
        } else {
            adminLi.classList.add("hidden");
        }
    } else {
        loginBlock.classList.remove("hidden");
        signupBlock.classList.add("hidden");
        profileBlock.classList.add("hidden");
        document.getElementById("admin-panel-link-li").classList.add("hidden");
    }
}

// 13. Setup Action Submissions for Forms
function setupFormSubmitListeners() {
    document.getElementById("switch-to-signup").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("login-form-block").classList.add("hidden");
        document.getElementById("signup-form-block").classList.remove("hidden");
        document.getElementById("login-error-msg").classList.add("hidden");
        document.getElementById("signup-error-msg").classList.add("hidden");
    });

    document.getElementById("switch-to-login").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("signup-form-block").classList.add("hidden");
        document.getElementById("login-form-block").classList.remove("hidden");
        document.getElementById("login-error-msg").classList.add("hidden");
        document.getElementById("signup-error-msg").classList.add("hidden");
    });

    // Handle Login Submit (Authenticates with live JWT backend)
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim().toLowerCase();
        const password = document.getElementById("login-password").value;
        
        const errorEl = document.getElementById("login-error-msg");
        const submitBtn = e.target.querySelector("button[type='submit']");
        
        errorEl.classList.add("hidden");
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = "Signing In...";
        
        try {
            const response = await fetch(API_BASE + '/api/auth/login', {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const json = await response.json();
            if (json.success) {
                const user = json.data.user;
                const token = json.data.token;
                
                localStorage.setItem("jhariya_token", token);
                simulatedUser = {
                    id: user._id,
                    name: user.fullName,
                    email: user.email,
                    role: user.role
                };
                saveUserSession();
                renderAccountDrawerState();
                closeDrawer("account-drawer-overlay");
                
                if (user.role === 'admin') {
                    alert("Welcome to Jhariya Owner Portal! Owner privileges unlocked.");
                } else {
                    alert(`Welcome back to Jhariya, ${user.fullName}!`);
                }
            } else {
                errorEl.querySelector(".error-text").textContent = json.message || "Invalid email or password.";
                errorEl.classList.remove("hidden");
            }
        } catch (err) {
            console.error(err);
            errorEl.querySelector(".error-text").textContent = "An error occurred during login.";
            errorEl.classList.remove("hidden");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    // Handle Signup Submit (Registers with live backend API)
    document.getElementById("signup-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("signup-name").value;
        const email = document.getElementById("signup-email").value.trim().toLowerCase();
        const password = document.getElementById("signup-password").value;
        const phoneInput = document.getElementById("signup-phone");
        const phone = phoneInput ? phoneInput.value.trim() : "+919999999999";
        
        const errorEl = document.getElementById("signup-error-msg");
        const submitBtn = e.target.querySelector("button[type='submit']");
        
        errorEl.classList.add("hidden");
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = "Registering...";
        
        try {
            const response = await fetch(API_BASE + '/api/auth/register', {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fullName: name, email, password, phone })
            });
            const json = await response.json();
            if (json.success) {
                const user = json.data.user;
                const token = json.data.token;
                
                localStorage.setItem("jhariya_token", token);
                simulatedUser = {
                    id: user._id,
                    name: user.fullName,
                    email: user.email,
                    role: user.role
                };
                saveUserSession();
                renderAccountDrawerState();
                closeDrawer("account-drawer-overlay");
                alert("Account created successfully!");
            } else {
                errorEl.querySelector(".error-text").textContent = json.message || "Registration failed.";
                errorEl.classList.remove("hidden");
            }
        } catch (err) {
            console.error(err);
            errorEl.querySelector(".error-text").textContent = "An error occurred during registration.";
            errorEl.classList.remove("hidden");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
        simulatedUser = null;
        localStorage.removeItem("jhariya_token");
        saveUserSession();
        
        // Reset inputs
        document.getElementById("login-email").value = "";
        document.getElementById("login-password").value = "";
        document.getElementById("signup-name").value = "";
        document.getElementById("signup-email").value = "";
        document.getElementById("signup-password").value = "";
        
        // Hide errors
        document.getElementById("login-error-msg").classList.add("hidden");
        document.getElementById("signup-error-msg").classList.add("hidden");
        
        // Reset cart
        cart = [];
        updateCartCount();
        renderCartItems();
        
        renderAccountDrawerState();
    });

    const modalTrackForm = document.getElementById("modal-track-form");
    if (modalTrackForm) {
        modalTrackForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const val = document.getElementById("modal-track-input").value;
            renderTrackResult(val, document.getElementById("modal-track-result"));
        });
    }

    document.getElementById("track-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const trackingNum = document.getElementById("track-input").value;
        const footerResultBox = document.getElementById("track-result");
        renderTrackResult(trackingNum, footerResultBox);
        openTrackOrderModal(trackingNum);
    });

    document.getElementById("contact-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("contact-email").value;
        document.getElementById("contact-email").value = "";
        document.getElementById("contact-message").value = "";
        alert(`Message received! We will reply to ${email} within 2 hours.`);
    });

    // Handle Checkout Secure Payment flow using dynamic backend Razorpay checkout
    document.getElementById("checkout-btn").addEventListener("click", async () => {
        const token = localStorage.getItem("jhariya_token");
        if (!token) {
            alert("Please log in to your account first before checking out.");
            closeDrawer("cart-drawer-overlay");
            openDrawer("account-drawer-overlay", "account-drawer");
            return;
        }

        if (cart.length === 0) {
            alert("Your shopping bag is empty.");
            return;
        }

        const items = cart.map(item => ({
            productId: item.product.id || item.product._id,
            quantity: item.qty,
            size: item.size
        }));

        const shippingAddress = {
            street: "123 MG Road",
            city: "Bengaluru",
            state: "Karnataka",
            postalCode: "560001"
        };

        const checkoutBtn = document.getElementById("checkout-btn");
        const originalBtnText = checkoutBtn.textContent;
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = "Initializing Checkout...";

        // Collect shipping address & payment method from user via form dialog
        const addressModal = document.createElement('div');
        addressModal.id = 'address-collection-modal';
        addressModal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;`;
        addressModal.innerHTML = `
            <div style="background:#fff;max-width:480px;width:100%;border-radius:8px;padding:28px;font-family:Montserrat,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
                <h3 style="font-family:'Playfair Display',serif;color:var(--brand-burgundy);margin:0 0 6px 0;font-size:1.3rem;">Checkout & Delivery Details</h3>
                <p style="color:var(--text-muted);font-size:0.78rem;margin:0 0 18px 0;">Where should we deliver your Jhariya parcel?</p>
                <form id="address-form">
                    <div style="margin-bottom:12px;">
                        <label style="display:block;font-size:0.78rem;font-weight:600;color:var(--brand-burgundy);margin-bottom:4px;">Street / House Number *</label>
                        <input id="addr-street" type="text" required placeholder="e.g. 12B, MG Road, Laxmi Nagar" style="width:100%;padding:10px 12px;border:1.5px solid var(--border-color);font-family:Montserrat;font-size:0.85rem;outline:none;border-radius:4px;box-sizing:border-box;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                        <div>
                            <label style="display:block;font-size:0.78rem;font-weight:600;color:var(--brand-burgundy);margin-bottom:4px;">City *</label>
                            <input id="addr-city" type="text" required placeholder="e.g. Jaipur" style="width:100%;padding:10px 12px;border:1.5px solid var(--border-color);font-family:Montserrat;font-size:0.85rem;outline:none;border-radius:4px;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block;font-size:0.78rem;font-weight:600;color:var(--brand-burgundy);margin-bottom:4px;">State *</label>
                            <input id="addr-state" type="text" required placeholder="e.g. Rajasthan" style="width:100%;padding:10px 12px;border:1.5px solid var(--border-color);font-family:Montserrat;font-size:0.85rem;outline:none;border-radius:4px;box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-size:0.78rem;font-weight:600;color:var(--brand-burgundy);margin-bottom:4px;">PIN Code *</label>
                        <input id="addr-pin" type="text" required placeholder="e.g. 302001" maxlength="6" pattern="[0-9]{6}" style="width:100%;padding:10px 12px;border:1.5px solid var(--border-color);font-family:Montserrat;font-size:0.85rem;outline:none;border-radius:4px;box-sizing:border-box;">
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block;font-size:0.78rem;font-weight:600;color:var(--brand-burgundy);margin-bottom:8px;">Payment Method *</label>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--brand-burgundy);border-radius:4px;cursor:pointer;background:#FAF7F2;" id="cod-label-box">
                                <input type="radio" name="pay-method" value="COD" checked style="accent-color:var(--brand-burgundy);">
                                <div>
                                    <strong style="display:block;font-size:0.85rem;color:var(--brand-burgundy);">💵 Cash on Delivery (COD)</strong>
                                    <span style="font-size:0.72rem;color:var(--text-muted);">Pay cash when parcel is delivered to your address</span>
                                </div>
                            </label>
                            <label style="display:none;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--border-color);border-radius:4px;cursor:pointer;background:#fff;" id="rzp-label-box">
                                <input type="radio" name="pay-method" value="Razorpay" style="accent-color:var(--brand-burgundy);">
                                <div>
                                    <strong style="display:block;font-size:0.85rem;color:var(--text-dark);">💳 Online Payment (Razorpay)</strong>
                                    <span style="font-size:0.72rem;color:var(--text-muted);">UPI, Cards, Net Banking & Wallets</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style="display:flex;gap:12px;">
                        <button type="button" id="addr-cancel-btn" style="flex:1;padding:12px;border:1.5px solid var(--border-color);background:none;font-family:Montserrat;font-size:0.85rem;cursor:pointer;border-radius:4px;">Cancel</button>
                        <button type="submit" id="confirm-order-submit-btn" style="flex:2;padding:12px;background:var(--brand-burgundy);color:#fff;border:none;font-family:Montserrat;font-size:0.85rem;font-weight:600;cursor:pointer;border-radius:4px;letter-spacing:0.5px;">Place Order (Cash on Delivery) →</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(addressModal);
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = originalBtnText;

        const streetInput = document.getElementById('addr-street');
        if (streetInput) streetInput.focus();

        const codBox = document.getElementById('cod-label-box');
        const rzpBox = document.getElementById('rzp-label-box');
        const confirmBtn = document.getElementById('confirm-order-submit-btn');

        addressModal.querySelectorAll('input[name="pay-method"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'COD') {
                    codBox.style.borderColor = 'var(--brand-burgundy)';
                    codBox.style.background = '#FAF7F2';
                    rzpBox.style.borderColor = 'var(--border-color)';
                    rzpBox.style.background = '#fff';
                    confirmBtn.textContent = 'Place Order (Cash on Delivery) →';
                } else {
                    rzpBox.style.borderColor = 'var(--brand-burgundy)';
                    rzpBox.style.background = '#FAF7F2';
                    codBox.style.borderColor = 'var(--border-color)';
                    codBox.style.background = '#fff';
                    confirmBtn.textContent = 'Proceed to Pay (Razorpay) →';
                }
            });
        });

        document.getElementById('addr-cancel-btn').addEventListener('click', () => {
            document.body.removeChild(addressModal);
        });

        document.getElementById('address-form').addEventListener('submit', async (evt) => {
            evt.preventDefault();
            const selectedPaymentMethod = addressModal.querySelector('input[name="pay-method"]:checked')?.value || 'COD';
            const shippingAddress = {
                street: document.getElementById('addr-street').value.trim(),
                city: document.getElementById('addr-city').value.trim(),
                state: document.getElementById('addr-state').value.trim(),
                postalCode: document.getElementById('addr-pin').value.trim(),
                country: 'India'
            };
            document.body.removeChild(addressModal);
            
            const checkoutBtnInner = document.getElementById("checkout-btn");
            checkoutBtnInner.disabled = true;
            checkoutBtnInner.textContent = "Processing Order...";

            try {
                const response = await fetch(API_BASE + '/api/orders/create', {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        products: items,
                        shippingAddress,
                        paymentMethod: selectedPaymentMethod
                    })
                });
                const json = await response.json();
                
                if (!json.success) {
                    if (response.status === 401 || (json.message && (json.message.toLowerCase().includes("token") || json.message.toLowerCase().includes("authorized")))) {
                        localStorage.removeItem("jhariya_token");
                        localStorage.removeItem("jhariya_user");
                        simulatedUser = null;
                        renderAccountDrawerState();
                        alert("Your session has expired. Please sign in again to continue checkout.");
                        closeDrawer("cart-drawer-overlay");
                        openDrawer("account-drawer-overlay", "account-drawer");
                        return;
                    }
                    alert(`Order creation failed: ${json.message}`);
                    return;
                }

                const newOrderRecord = {
                    _id: json.data.orderId,
                    trackingId: json.data.trackingId,
                    total: json.data.total,
                    paymentMethod: selectedPaymentMethod,
                    paymentStatus: 'pending',
                    orderStatus: 'processing',
                    createdAt: new Date().toISOString(),
                    products: items.map(it => {
                        const p = PRODUCTS_DB.find(prod => (prod.id === it.productId || prod._id === it.productId));
                        return {
                            product: p || { title: 'Designer Kurti', images: ['assets/logo.png'], price: 0 },
                            quantity: it.quantity,
                            size: it.size,
                            price: p ? p.price : 0
                        };
                    })
                };
                if (typeof saveOrderToLocalHistory === 'function') {
                    saveOrderToLocalHistory(newOrderRecord);
                }

                // If Cash on Delivery (COD) selected
                if (selectedPaymentMethod === 'COD' || json.data?.isCOD) {
                    alert(`🎉 Order Placed Successfully!\n\nOrder Tracking ID: ${json.data.trackingId}\nPayment Method: Cash on Delivery\nTotal Amount: ₹${(json.data.total || 0).toLocaleString('en-IN')}\n\nThank you for shopping with JHARIYA! ✨`);
                    cart = [];
                    updateCartCount();
                    renderCartItems();
                    closeDrawer("cart-drawer-overlay");
                    openTrackOrderModal(json.data.trackingId);
                    return;
                }

                // If Razorpay selected
                const { razorpayOrderId, amount, key } = json.data;

                // Check if Razorpay SDK is loaded
                if (typeof Razorpay === 'undefined') {
                    alert("Razorpay SDK failed to load. Please check your internet connection.");
                    return;
                }

                const options = {
                    key: key || "rzp_test_placeholder_key",
                    amount: amount,
                    currency: "INR",
                    name: "Jhariya Ethnic Wear",
                    description: "Purchase Handcrafted Designer Kurtis",
                    image: "assets/logo.png",
                    order_id: razorpayOrderId,
                    handler: async function (rzpResponse) {
                        try {
                            const verifyRes = await fetch(API_BASE + '/api/orders/verify', {
                                method: 'POST',
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    razorpayOrderId: rzpResponse.razorpay_order_id || razorpayOrderId,
                                    razorpayPaymentId: rzpResponse.razorpay_payment_id || (razorpayOrderId.startsWith('rzp_order_mock_') ? `pay_mock_${Date.now()}` : ''),
                                    razorpaySignature: rzpResponse.razorpay_signature || (razorpayOrderId.startsWith('rzp_order_mock_') ? 'mock_sig' : '')
                                })
                            });
                            const verifyJson = await verifyRes.json();
                            if (verifyJson.success) {
                                alert("Payment successful! Thank you for shopping with JHARIYA! ✨");
                                cart = [];
                                updateCartCount();
                                renderCartItems();
                                closeDrawer("cart-drawer-overlay");
                                if (json.data.trackingId) {
                                    openTrackOrderModal(json.data.trackingId);
                                }
                            } else {
                                alert(`Verification failed: ${verifyJson.message}`);
                            }
                        } catch (err) {
                            console.error(err);
                            alert("An error occurred during payment verification.");
                        }
                    },
                    prefill: {
                        name: simulatedUser ? (simulatedUser.fullName || simulatedUser.name || "Customer") : "Customer",
                        email: simulatedUser ? (simulatedUser.email || "customer@jhariya.com") : "customer@jhariya.com",
                        contact: simulatedUser ? (simulatedUser.phone || "9999999999") : "9999999999"
                    },
                    theme: { color: "#2D0B12" }
                };

                const rzp = new Razorpay(options);
                rzp.on('payment.failed', function (rzpResponse) {
                    alert(`Payment failed: ${rzpResponse.error ? (rzpResponse.error.description || rzpResponse.error.reason) : 'Payment cancelled'}`);
                });
                rzp.open();
            } catch (err) {
                console.error(err);
                alert("Failed to process checkout. Please try again.");
            } finally {
                checkoutBtnInner.disabled = false;
                checkoutBtnInner.textContent = "Proceed to Secure Checkout";
            }
        });
    });
}

// 14. Accordion Policy Drawer Handlers
function setupAccordionListeners() {
    const accordions = document.querySelectorAll(".accordion-item");
    accordions.forEach(item => {
        const header = item.querySelector(".accordion-header");
        header.addEventListener("click", () => {
            accordions.forEach(other => {
                if (other !== item) other.classList.remove("active");
            });
            item.classList.toggle("active");
        });
    });
}

// ==========================================================================
// Size Chart Modal (global, called from product detail modal)
// ==========================================================================
window.showSizeChart = function(e) {
    if (e) e.preventDefault();
    const existing = document.getElementById('size-chart-modal');
    if (existing) { existing.remove(); return; }

    const modal = document.createElement('div');
    modal.id = 'size-chart-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div style="background:#fff;max-width:560px;width:100%;max-height:85vh;overflow-y:auto;border-radius:10px;box-shadow:0 24px 72px rgba(0,0,0,0.35);font-family:Montserrat,sans-serif;">
            <div style="background:#2D0B12;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h3 style="color:#fff;font-family:'Playfair Display',serif;margin:0;font-size:1.2rem;">Jhariya Size Chart</h3>
                    <p style="color:rgba(255,255,255,0.72);font-size:0.72rem;margin:4px 0 0 0;">All measurements in inches. Size up if between two sizes.</p>
                </div>
                <button onclick="document.getElementById('size-chart-modal').remove()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;line-height:1;">×</button>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                    <thead>
                        <tr style="background:#faf7f2;">
                            <th style="padding:11px 16px;text-align:left;color:#2D0B12;font-weight:700;border-bottom:2px solid #e8ddd3;">Size</th>
                            <th style="padding:11px 12px;text-align:center;color:#2D0B12;font-weight:700;border-bottom:2px solid #e8ddd3;">Chest</th>
                            <th style="padding:11px 12px;text-align:center;color:#2D0B12;font-weight:700;border-bottom:2px solid #e8ddd3;">Waist</th>
                            <th style="padding:11px 12px;text-align:center;color:#2D0B12;font-weight:700;border-bottom:2px solid #e8ddd3;">Hip</th>
                            <th style="padding:11px 12px;text-align:center;color:#2D0B12;font-weight:700;border-bottom:2px solid #e8ddd3;">Length</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${[
                            ['XXS','32','26','34','40'],
                            ['XS', '34','28','36','41'],
                            ['S',  '36','30','38','42'],
                            ['M',  '38','32','40','43'],
                            ['L',  '40','34','42','44'],
                            ['XL', '42','36','44','45'],
                            ['2XL','44','38','46','46'],
                            ['3XL','46','40','48','47'],
                            ['4XL','48','43','50','48'],
                            ['5XL','54','48','56','49'],
                        ].map((r,i) => `
                            <tr style="background:${i%2===0?'#fff':'#faf7f2'};">
                                <td style="padding:9px 16px;font-weight:700;color:#2D0B12;border-bottom:1px solid #e8ddd3;">${r[0]}</td>
                                <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e8ddd3;">${r[1]}"</td>
                                <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e8ddd3;">${r[2]}"</td>
                                <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e8ddd3;">${r[3]}"</td>
                                <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #e8ddd3;">${r[4]}"</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="padding:12px 20px;background:#faf7f2;border-top:1px solid #e8ddd3;">
                <p style="margin:0;font-size:0.7rem;color:#767676;line-height:1.6;">📐 Measure your <strong>chest</strong> at the fullest point, <strong>waist</strong> at the narrowest, and <strong>hip</strong> at the widest. Keep tape snug but not tight. When in doubt, size up for comfortable ethnic drape.</p>
            </div>
        </div>
    `;
    modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};


let uploadedImagesList = [];

function renderMultiImagePreviews() {
    const grid = document.getElementById("multi-image-preview-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    uploadedImagesList.forEach((imgSrc, idx) => {
        const item = document.createElement("div");
        item.className = "multi-preview-item";
        item.innerHTML = `
            <img src="${imgSrc}" alt="Photo ${idx + 1}">
            <button type="button" class="multi-preview-remove" data-idx="${idx}">×</button>
        `;
        item.querySelector(".multi-preview-remove").addEventListener("click", () => {
            uploadedImagesList.splice(idx, 1);
            renderMultiImagePreviews();
        });
        grid.appendChild(item);
    });
}

function setupAdminListeners() {
    const fileInput = document.getElementById("crud-image-file");
    const dragZone = document.getElementById("upload-drag-zone");
    const urlsTextarea = document.getElementById("crud-image-urls");

    if (dragZone && fileInput) {
        dragZone.addEventListener("click", () => fileInput.click());

        dragZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dragZone.classList.add("dragover");
        });
        dragZone.addEventListener("dragleave", () => {
            dragZone.classList.remove("dragover");
        });
        dragZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dragZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) {
                handleUploadedFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleUploadedFiles(e.target.files);
            }
        });
    }

    if (urlsTextarea) {
        urlsTextarea.addEventListener("input", () => {
            const lines = urlsTextarea.value.split('\n').map(l => l.trim()).filter(Boolean);
            lines.forEach(url => {
                if (url && !uploadedImagesList.includes(url)) {
                    uploadedImagesList.push(url);
                }
            });
            renderMultiImagePreviews();
        });
    }

    async function handleUploadedFiles(files) {
        const token = localStorage.getItem('jhariya_token');
        const uploadZoneLabel = dragZone ? dragZone.querySelector('.upload-prompt') : null;
        if (uploadZoneLabel) uploadZoneLabel.innerHTML = '⏳ Uploading...';

        const formData = new FormData();
        Array.from(files).forEach(file => {
            if (!file.type.match('image.*')) return;
            formData.append('images', file);
        });

        try {
            const res = await fetch(API_BASE + '/api/admin/upload-images', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                json.data.forEach(url => {
                    if (!uploadedImagesList.includes(url)) uploadedImagesList.push(url);
                });
                renderMultiImagePreviews();
            } else {
                alert('Upload failed: ' + (json.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('Image upload error:', err);
            alert('Could not upload images. Check server connection.');
        } finally {
            if (uploadZoneLabel) uploadZoneLabel.innerHTML = 'Drag & Drop photo(s) here, or <strong>Browse Files (Select Multiple)</strong>';
        }
    }
    
    // Overlay Visibility Toggles
    document.getElementById("open-admin-dashboard-btn").addEventListener("click", (e) => {
        e.preventDefault();
        closeDrawer("account-drawer-overlay");
        openDrawer("admin-dashboard-overlay", "admin-dashboard");
        renderAdminProducts();
        
        // Reset tab view to products list
        document.querySelectorAll(".admin-nav-links li").forEach(t => t.classList.remove("active"));
        const manageTab = document.querySelector('.admin-nav-links li[data-tab="manage-products"]');
        if (manageTab) manageTab.classList.add("active");
        document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.add("hidden"));
        const manageContent = document.getElementById("tab-manage-products");
        if (manageContent) manageContent.classList.remove("hidden");
    });
    
    document.getElementById("close-admin-dashboard-btn").addEventListener("click", () => {
        closeDrawer("admin-dashboard-overlay");
    });
    
    // CRUD Create Form Overlay launchers
    document.getElementById("open-product-modal-btn").addEventListener("click", () => {
        document.getElementById("product-crud-form").reset();
        document.getElementById("crud-product-id").value = "";
        document.getElementById("product-modal-title").textContent = "Add New Kurti Listing";
        uploadedImagesList = [];
        if (urlsTextarea) urlsTextarea.value = "";
        renderMultiImagePreviews();
        
        // Reset checkboxes default S-XXL
        document.querySelectorAll('input[name="crud-sizes"]').forEach(cb => cb.checked = true);
        
        document.getElementById("product-form-modal-overlay").classList.add("open");
    });
    
    const closeForm = () => {
        document.getElementById("product-form-modal-overlay").classList.remove("open");
    };
    document.getElementById("close-product-modal-btn").addEventListener("click", closeForm);
    document.getElementById("cancel-product-modal-btn").addEventListener("click", closeForm);
    
    // CRUD Save Form Submission
    document.getElementById("product-crud-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        console.log("Submitting product CRUD form...");
        const idVal = document.getElementById("crud-product-id").value;
        const title = document.getElementById("crud-title").value.trim();
        const priceVal = document.getElementById("crud-price").value;
        const price = parseInt(priceVal);
        const fabric = document.getElementById("crud-fabric").value.trim();
        const style = document.getElementById("crud-style").value.trim();
        const color = document.getElementById("crud-color").value.trim();
        const description = document.getElementById("crud-description").value.trim();
        const length = document.getElementById("crud-length").value.trim();
        const neck = document.getElementById("crud-neck").value.trim();
        const sleeve = document.getElementById("crud-sleeve").value.trim();
        const fit = document.getElementById("crud-fit").value.trim();
        const wash = document.getElementById("crud-wash").value.trim();
        const embroidery = document.getElementById("crud-embroidery").value.trim();
        
        const sizesArray = Array.from(document.querySelectorAll('input[name="crud-sizes"]:checked')).map(cb => cb.value);
        
        if (!title) {
            alert("Please enter a Kurti Design Name!");
            return;
        }
        if (isNaN(price) || price <= 0) {
            alert("Please enter a valid positive price!");
            return;
        }
        if (!fabric) {
            alert("Please enter a Fabric Material!");
            return;
        }
        if (!style) {
            alert("Please enter a Silhouette / Style Fit!");
            return;
        }
        if (sizesArray.length === 0) {
            alert("Please select at least one available size for this Kurti!");
            return;
        }
        
        const token = localStorage.getItem("jhariya_token");
        if (!token) {
            alert("Please log in as an administrator first.");
            return;
        }

        let images = [...uploadedImagesList];
        if (urlsTextarea && urlsTextarea.value.trim()) {
            const urlLines = urlsTextarea.value.split('\n').map(l => l.trim()).filter(Boolean);
            urlLines.forEach(u => {
                if (!images.includes(u)) images.push(u);
            });
        }

        if (images.length === 0 && idVal !== "") {
            const existingProduct = PRODUCTS_DB.find(p => p.id === idVal);
            if (existingProduct) {
                images = (Array.isArray(existingProduct.images) && existingProduct.images.length > 0)
                    ? existingProduct.images
                    : [existingProduct.image];
            }
        }

        if (images.length === 0) {
            alert("Please upload or add at least one product photo!");
            return;
        }

        const productData = {
            title,
            description,
            price,
            fabric,
            style,
            color,
            embroidery,
            sleeve,
            neck,
            fit,
            washCare: wash,
            length,
            sizes: sizesArray,
            images: images,
            image: images[0],
            stock: 50
        };

        try {
            let response;
            if (idVal === "") {
                console.log("Sending POST request to create new product...", productData);
                response = await fetch(API_BASE + '/api/admin/product', {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(productData)
                });
            } else {
                console.log(`Sending PUT request to update product ${idVal}...`, productData);
                response = await fetch(`${API_BASE}/api/admin/product/${idVal}`, {
                    method: 'PUT',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(productData)
                });
            }

            const json = await response.json();
            console.log("Server response received:", json);
            if (json.success) {
                if (idVal === "") {
                    alert(`Success! Designer Kurti "${title}" has been uploaded.`);
                } else {
                    alert(`Success! Listing "${title}" has been modified.`);
                }
                await loadProductsFromStorage();
                closeForm();
                
                currentPage = 1;
                applyFiltersAndSorting();
                renderProducts();
                renderAdminProducts();
                console.log("Storefront and admin catalog table refreshed successfully.");
            } else {
                console.error("Save operation failed on server:", json.message);
                alert(`Operation failed: ${json.message}`);
            }
        } catch (err) {
            console.error("Error occurred during product save:", err);
            alert("An error occurred while saving the product.");
        }
    });

    // Admin tab switching logic
    const tabs = document.querySelectorAll(".admin-nav-links li");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const tabId = tab.dataset.tab;
            if (tabId === "metrics") return; // Keep alert for metrics if clicked
            
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            document.querySelectorAll(".admin-tab-content").forEach(content => {
                content.classList.add("hidden");
            });
            
            const targetContent = document.getElementById(`tab-${tabId}`);
            if (targetContent) {
                targetContent.classList.remove("hidden");
            }

            if (tabId === "settings") {
                document.getElementById("settings-about-us").value = jhariyaAboutText;
            }
        });
    });

    // Admin Settings Submit
    document.getElementById("admin-settings-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = document.getElementById("settings-about-us").value.trim();
        const token = localStorage.getItem("jhariya_token");
        
        try {
            const response = await fetch(API_BASE + '/api/admin/settings', {
                method: 'PUT',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ aboutUs: text })
            });
            const json = await response.json();
            if (json.success) {
                jhariyaAboutText = text;
                renderAboutText();
                alert("Boutique brand bio settings updated successfully!");
            } else {
                alert(`Error: ${json.message}`);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to update settings.");
        }
    });
}

// Global actions accessed by table row buttons
window.editAdminProduct = function(productId) {
    console.log(`Editing product ID: ${productId}`);
    const product = PRODUCTS_DB.find(p => p.id === productId);
    if (!product) {
        console.error(`Product with ID ${productId} not found in database!`);
        return;
    }
    
    console.log("Loading product data into form fields:", product);
    document.getElementById("crud-product-id").value = product.id;
    document.getElementById("crud-title").value = product.title;
    document.getElementById("crud-price").value = product.price;
    document.getElementById("crud-fabric").value = product.fabric || "";
    document.getElementById("crud-style").value = product.style || "";
    document.getElementById("crud-color").value = product.color || (product.specs && product.specs.color) || "";
    document.getElementById("crud-description").value = product.description || "";
    document.getElementById("crud-length").value = product.length || (product.specs && product.specs.length) || "";
    document.getElementById("crud-neck").value = product.neck || (product.specs && product.specs.neck) || "";
    document.getElementById("crud-sleeve").value = product.sleeve || (product.specs && product.specs.sleeve) || "";
    document.getElementById("crud-fit").value = product.fit || (product.specs && product.specs.fit) || "";
    document.getElementById("crud-wash").value = product.wash || product.washCare || (product.specs && (product.specs.wash || product.specs.washCare)) || "";
    document.getElementById("crud-embroidery").value = product.embroidery || (product.specs && product.specs.embroidery) || "";
    
    // Checkboxes sync
    document.querySelectorAll('input[name="crud-sizes"]').forEach(cb => {
        cb.checked = product.sizes && product.sizes.includes(cb.value);
    });
    
    document.getElementById("product-modal-title").textContent = "Edit Kurti Listing";
    
    // Edit modal preparation
    uploadedImagesList = (Array.isArray(product.images) && product.images.length > 0)
        ? [...product.images]
        : (product.image ? [product.image] : []);
    
    renderMultiImagePreviews();
    const urlsTextarea = document.getElementById("crud-image-urls");
    if (urlsTextarea) urlsTextarea.value = "";
    
    document.getElementById("product-form-modal-overlay").classList.add("open");
};

window.deleteAdminProduct = async function(productId) {
    const product = PRODUCTS_DB.find(p => p.id === productId);
    if (!product) return;
    
    if (confirm(`Are you absolutely sure you want to delete "${product.title}"?`)) {
        const token = localStorage.getItem("jhariya_token");
        try {
            const response = await fetch(`${API_BASE}/api/admin/product/${productId}`, {
                method: 'DELETE',
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const json = await response.json();
            if (json.success) {
                alert(`Success! Listing "${product.title}" has been deleted.`);
                await loadProductsFromStorage();
                currentPage = 1;
                applyFiltersAndSorting();
                renderProducts();
                renderAdminProducts();
            } else {
                alert(`Failed to delete product: ${json.message}`);
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred while deleting the product.");
        }
    }
};

window.renderAdminProducts = function() {
    const tbody = document.getElementById("admin-products-table-body");
    tbody.innerHTML = "";
    
    if (PRODUCTS_DB.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Your boutique catalog is currently empty! Click "+ Add New Kurti" to upload your first pattern.
                </td>
            </tr>
        `;
        return;
    }
    
    PRODUCTS_DB.forEach(product => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <img src="${product.image}" class="admin-thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'50\\' height=\\'65\\' style=\\'background:%23F8F3E3;fill:%232D0B12;\\'></svg>'">
            </td>
            <td>
                <div class="admin-product-name">${escapeHTML(product.title)}</div>
            </td>
            <td>
                <span class="admin-badge-type">${product.fabric}</span>
            </td>
            <td>
                <span class="admin-badge-type" style="background-color: var(--border-color);">${product.style}</span>
            </td>
            <td>
                <span class="admin-price">₹${product.price.toLocaleString('en-IN')}</span>
            </td>
            <td>
                <div class="admin-size-pills">
                    ${product.sizes.map(size => `<span class="admin-size-pill">${size}</span>`).join('')}
                  </div>
            </td>
            <td>
                <div class="admin-actions">
                    <button class="admin-action-btn edit-btn" onclick="editAdminProduct('${product.id}')">Edit</button>
                    <button class="admin-action-btn delete-btn" onclick="deleteAdminProduct('${product.id}')">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// Escape helper for HTML tags
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
