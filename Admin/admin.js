
let productsData = [];      // 存放从数据库获取的原始数据
let filteredProducts = [];  // 存放过滤/排序后的数据

// Admin Dashboard JavaScript
if (!localStorage.getItem('siteAnalytics')) {
    localStorage.setItem('siteAnalytics', JSON.stringify({
        monthlyRevenue: {},
        orders: {},
        revenue: {},
        pageViews: {},
        popularProducts: {}
    }));
}

// ========================================
// GLOBAL LOGOUT FUNCTION
// ========================================
function logout() {
  const confirmLogout = confirm('Are you sure you want to log out?');
  if (!confirmLogout) return;
  
  // 1. 清理所有可能的登录键值
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userData');
  localStorage.removeItem('currentUser'); // ✅ 必须清理这个
  sessionStorage.clear();
  
  // 2. 清理管理员相关的特定数据
  const adminEmail = 'admin@dayangsari.com';
  localStorage.removeItem('cart_' + adminEmail);
  localStorage.removeItem('wishlist_' + adminEmail);
  localStorage.removeItem('orderHistory_' + adminEmail);
    
  // 3. 强制跳转回首页
  window.location.replace('../index.html'); // ✅ 使用 replace 防止点击“后退”回来
}
// ========================================
// DASHBOARD FUNCTIONS
// ========================================
function initializeDashboard() {
    if (!window.location.pathname.includes('admin.html')) return;

    // 强制检查权限
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || user.role !== 'admin') {
        window.location.replace('../signin.html');
        return;
    }

    if (!window.location.pathname.includes('admin.html')) return;
    
    console.log('📊 Initializing dashboard...');
    
    // Initialize Charts
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    const salesChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Sales (RM)',
                data: [0, 0, 0, 0],
                borderColor: '#8b4513',
                backgroundColor: 'rgba(212,165,116,0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return 'RM ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'RM ' + value.toFixed(0);
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
    
    // Store chart globally for updates
    window.dashboardSalesChart = salesChart;
    
    // Load real data
    loadDashboardData();
    
    console.log('✅ Dashboard initialized');
}

async function loadDashboardData() {
    console.log('📈 Loading dashboard data...');
    
    // 1. 获取 analytics 数据（优先从 localStorage 获取统计模板）
    const analytics = JSON.parse(localStorage.getItem('siteAnalytics')) || {
        monthlyRevenue: {},
        orders: {},
        revenue: {}
    };
    
    // 2. 获取当前月份 (YYYY-MM)
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    // 3. 计算本月收入
    const monthRevenue = (analytics.monthlyRevenue && analytics.monthlyRevenue[currentMonth]) || 0;
    
    // 4. 计算本月订单量
    let monthOrders = 0;
    if (analytics && analytics.orders) {
        Object.keys(analytics.orders).forEach(date => {
            if (date && typeof date === 'string' && date.startsWith(currentMonth)) {
                monthOrders += analytics.orders[date];
            }
        });
    }
    
    // 5. 统计待处理订单 (从所有用户的订单历史中查找)
    let pendingOrders = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('orderHistory_')) {
            try {
                const orders = JSON.parse(localStorage.getItem(key)) || [];
                pendingOrders += orders.filter(o => o.status === 'pending').length;
            } catch (e) { console.error("Error parsing orders for pending count"); }
        }
    }
    
    // 6. 统计唯一客户数
    const uniqueCustomers = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('registeredUser_')) {
            const email = key.replace('registeredUser_', '');
            if (email !== 'admin@dayangsari.com') {
                uniqueCustomers.add(email);
            }
        }
    }
    
    // 7. 获取产品总数和在库数 (关键修复点)
    let totalProducts = 0;
    let inStockProducts = 0;
    
    try {
        const allProducts = await getAllProducts(); // 等待异步返回
        if (allProducts && Array.isArray(allProducts)) {
            totalProducts = allProducts.length;
            inStockProducts = allProducts.filter(p => p.stock > 0).length;
        }
    } catch (error) {
        console.error("❌ Error fetching products:", error);
    }
    
    // 8. 更新仪表盘卡片 (UI 更新)
    const totalSalesEl = document.getElementById('total-sales');
    const totalOrdersEl = document.getElementById('total-orders');
    const totalCustomersEl = document.getElementById('total-customers');
    const totalProductsEl = document.getElementById('total-products');

    // 更新产品卡片
    if (totalProductsEl) {
        totalProductsEl.innerText = totalProducts;
        // 更新卡片下方的副标题
        const pSubtitle = totalProductsEl.nextElementSibling;
        if (pSubtitle && pSubtitle.classList.contains('card-subtitle')) {
            pSubtitle.textContent = `In stock: ${inStockProducts}`;
        }
    }
    
    // 更新销售额
    if (totalSalesEl) {
        totalSalesEl.textContent = `RM ${monthRevenue.toFixed(2)}`;
    }
    
    // 更新订单数
    if (totalOrdersEl) {
        totalOrdersEl.textContent = monthOrders;
        const oSubtitle = totalOrdersEl.nextElementSibling;
        if (oSubtitle && oSubtitle.classList.contains('card-subtitle')) {
            oSubtitle.textContent = `Pending: ${pendingOrders}`;
        }
    }
    
    // 更新客户数
    if (totalCustomersEl) {
        totalCustomersEl.textContent = uniqueCustomers.size;
    }
    
    // 9. 更新图表和最近订单列表
    if (typeof updateDashboardSalesChart === 'function') {
        updateDashboardSalesChart(analytics);
    }
    
    if (typeof loadRecentOrders === 'function') {
        loadRecentOrders();
    }
    
    // 10. 打印日志 (此时 inStockProducts 已定义，不会报错)
    console.log('✅ Dashboard data loaded:', {
        revenue: monthRevenue,
        orders: monthOrders,
        pending: pendingOrders,
        customers: uniqueCustomers.size,
        totalProducts: totalProducts,
        inStock: inStockProducts
    });
}

function updateDashboardSalesChart(analytics) {
    if (!window.dashboardSalesChart) return;
    
    const today = new Date();
    const labels = [];
    const data = [];
    
    // Get last 4 weeks of data
    for (let week = 3; week >= 0; week--) {
        let weekTotal = 0;
        for (let day = 0; day < 7; day++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (week * 7 + day));
            const dateStr = date.toISOString().split('T')[0];
            weekTotal += (analytics.revenue && analytics.revenue[dateStr]) || 0;
        }
        labels.push(`Week ${4 - week}`);
        data.push(weekTotal);
    }
    
    window.dashboardSalesChart.data.labels = labels;
    window.dashboardSalesChart.data.datasets[0].data = data;
    window.dashboardSalesChart.update();
}

function loadRecentOrders() {
    const tbody = document.getElementById('recent-orders-body');
    if (!tbody) return;
    
    // Collect all orders from all customers
    const allOrders = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key.startsWith('orderHistory_')) {
            const customerEmail = key.replace('orderHistory_', '');
            const orders = JSON.parse(localStorage.getItem(key)) || [];
            
            orders.forEach(order => {
                allOrders.push({
                    id: `ORD-${customerEmail.substring(0, 3).toUpperCase()}-${Date.parse(order.time)}`,
                    customer: order.name,
                    customerEmail: customerEmail,
                    total: order.total,
                    status: order.status || 'completed',
                    payment: order.paymentCompleted ? 'paid' : 'pending',
                    date: order.time,
                    orderDate: new Date(order.orderDate || order.time)
                });
            });
        }
    }
    
    // Sort by date (newest first) and take top 5
    const recentOrders = allOrders
        .sort((a, b) => b.orderDate - a.orderDate)
        .slice(0, 5);
    
    if (recentOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #999;">
                    No recent orders
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = recentOrders.map(order => `
        <tr>
            <td><strong>${order.id}</strong></td>
            <td>
                ${order.customer}<br>
                <small style="color: #666;">${order.customerEmail}</small>
            </td>
            <td><strong>RM ${order.total.toFixed(2)}</strong></td>
            <td>
                <span class="status-badge status-${order.status}">
                    ${capitalizeFirst(order.status)}
                </span>
            </td>
            <td>${formatDateShort(order.date)}</td>
        </tr>
    `).join('');
}

// NEW: Format date in short format for recent orders
function formatDateShort(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

// NEW: Refresh dashboard data
function refreshDashboard() {
    console.log('🔄 Refreshing dashboard...');
    loadDashboardData();
    showToast('Dashboard refreshed!', 'success', 2000);
}

// NEW: Get dashboard summary
function getDashboardSummary() {
    const analytics = JSON.parse(localStorage.getItem('siteAnalytics')) || {};
    
    // Current month
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthRevenue = (analytics.monthlyRevenue && analytics.monthlyRevenue[currentMonth]) || 0;
    
    // Count orders
    let totalOrders = 0;
    let pendingOrders = 0;
    let processingOrders = 0;
    let shippedOrders = 0;
    let deliveredOrders = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('orderHistory_')) {
            const orders = JSON.parse(localStorage.getItem(key)) || [];
            totalOrders += orders.length;
            pendingOrders += orders.filter(o => o.status === 'pending').length;
            processingOrders += orders.filter(o => o.status === 'processing').length;
            shippedOrders += orders.filter(o => o.status === 'shipped').length;
            deliveredOrders += orders.filter(o => o.status === 'delivered').length;
        }
    }
    
    // Count customers
    let totalCustomers = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('registeredUser_')) {
            const email = key.replace('registeredUser_', '');
            if (email !== 'admin@dayangsari.com') {
                totalCustomers++;
            }
        }
    }
    
    // Products
    const allProducts = getAllProducts();
    const inStockProducts = allProducts.filter(p => p.stock > 0).length;
    const lowStockProducts = allProducts.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStockProducts = allProducts.filter(p => p.stock === 0).length;
    
    const summary = {
        '📊 FINANCIAL': {
            'This Month Revenue': `RM ${monthRevenue.toFixed(2)}`,
            'Total All-Time Revenue': `RM ${Object.values(analytics.revenue || {}).reduce((a, b) => a + b, 0).toFixed(2)}`
        },
        '📦 ORDERS': {
            'Total Orders': totalOrders,
            'Pending': pendingOrders,
            'Processing': processingOrders,
            'Shipped': shippedOrders,
            'Delivered': deliveredOrders
        },
        '👥 CUSTOMERS': {
            'Total Customers': totalCustomers,
            'New This Month': (analytics.newCustomers && Object.keys(analytics.newCustomers)
                .filter(date => date.startsWith(currentMonth))
                .reduce((sum, date) => sum + analytics.newCustomers[date], 0)) || 0
        },
        '📦 PRODUCTS': {
            'Total Products': allProducts.length,
            'In Stock': inStockProducts,
            'Low Stock': lowStockProducts,
            'Out of Stock': outOfStockProducts
        }
    };
    
    console.log('📊 DASHBOARD SUMMARY');
    console.log('═══════════════════════════════════════');
    console.table(summary['📊 FINANCIAL']);
    console.table(summary['📦 ORDERS']);
    console.table(summary['👥 CUSTOMERS']);
    console.table(summary['📦 PRODUCTS']);
    console.log('═══════════════════════════════════════');
    
    return summary;
}

// NEW: Get business insights
function getBusinessInsights() {
    const analytics = JSON.parse(localStorage.getItem('siteAnalytics')) || {};
    
    // Calculate conversion rate
    const totalVisits = Object.values(analytics.pageViews || {}).reduce((sum, dayViews) => {
        return sum + (dayViews['home'] || 0) + (dayViews['index'] || 0);
    }, 0);
    
    let totalOrders = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('orderHistory_')) {
            const orders = JSON.parse(localStorage.getItem(key)) || [];
            totalOrders += orders.length;
        }
    }
    
    const conversionRate = totalVisits > 0 ? (totalOrders / totalVisits * 100) : 0;
    
    // Get top product
    let topProduct = 'None';
    let topRevenue = 0;
    
    if (analytics.popularProducts) {
        Object.entries(analytics.popularProducts).forEach(([id, stats]) => {
            if (stats.revenue > topRevenue) {
                topRevenue = stats.revenue;
                const product = products[id];
                topProduct = product ? product.name : `Product ${id}`;
            }
        });
    }
    
    // Calculate average order value
    const totalRevenue = Object.values(analytics.revenue || {}).reduce((a, b) => a + b, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Get most used payment method
    let topPaymentMethod = 'None';
    let maxCount = 0;
    
    if (analytics.paymentMethods) {
        Object.entries(analytics.paymentMethods).forEach(([method, count]) => {
            if (count > maxCount) {
                maxCount = count;
                topPaymentMethod = method;
            }
        });
    }
    
    const insights = {
        '🎯 KEY METRICS': {
            'Conversion Rate': `${conversionRate.toFixed(2)}%`,
            'Avg Order Value': `RM ${avgOrderValue.toFixed(2)}`,
            'Total Site Visits': totalVisits,
            'Total Orders': totalOrders
        },
        '🏆 TOP PERFORMERS': {
            'Best Selling Product': topProduct,
            'Revenue from Top Product': `RM ${topRevenue.toFixed(2)}`,
            'Most Used Payment': topPaymentMethod,
            'Times Used': maxCount
        }
    };
    
    console.log('💡 BUSINESS INSIGHTS');
    console.log('═══════════════════════════════════════');
    console.table(insights['🎯 KEY METRICS']);
    console.table(insights['🏆 TOP PERFORMERS']);
    console.log('═══════════════════════════════════════');
    
    return insights;
}

// NEW: Quick stats for dashboard
function quickStats() {
    console.log('⚡ QUICK STATS');
    console.log('═══════════════════════════════════════');
    
    const analytics = JSON.parse(localStorage.getItem('siteAnalytics')) || {};
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    console.log(`💰 This Month: RM ${(analytics.monthlyRevenue && analytics.monthlyRevenue[currentMonth] || 0).toFixed(2)}`);
    console.log(`📦 Total Orders: ${Object.values(analytics.orders || {}).reduce((a, b) => a + b, 0)}`);
    console.log(`👥 Total Customers: ${[...new Set(Object.keys(localStorage).filter(k => k.startsWith('registeredUser_')))].length - 1}`); // -1 for admin
    console.log(`📊 Total Products: ${getAllProducts().length}`);
    console.log('═══════════════════════════════════════');
}

// NEW: Export dashboard report
function exportDashboardReport() {
    const summary = getDashboardSummary();
    const insights = getBusinessInsights();
    
    const reportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let report = `DAYANGSARI ENTERPRISE - DASHBOARD REPORT\n`;
    report += `Generated: ${reportDate}\n`;
    report += `${'='.repeat(60)}\n\n`;
    
    // Financial
    report += `📊 FINANCIAL SUMMARY\n`;
    report += `${'-'.repeat(60)}\n`;
    Object.entries(summary['📊 FINANCIAL']).forEach(([key, value]) => {
        report += `${key}: ${value}\n`;
    });
    report += `\n`;
    
    // Orders
    report += `📦 ORDERS STATUS\n`;
    report += `${'-'.repeat(60)}\n`;
    Object.entries(summary['📦 ORDERS']).forEach(([key, value]) => {
        report += `${key}: ${value}\n`;
    });
    report += `\n`;
    
    // Customers
    report += `👥 CUSTOMER METRICS\n`;
    report += `${'-'.repeat(60)}\n`;
    Object.entries(summary['👥 CUSTOMERS']).forEach(([key, value]) => {
        report += `${key}: ${value}\n`;
    });
    report += `\n`;
    
    // Products
    report += `📦 PRODUCT INVENTORY\n`;
    report += `${'-'.repeat(60)}\n`;
    Object.entries(summary['📦 PRODUCTS']).forEach(([key, value]) => {
        report += `${key}: ${value}\n`;
    });
    report += `\n`;
    
    // Insights
    report += `💡 BUSINESS INSIGHTS\n`;
    report += `${'-'.repeat(60)}\n`;
    Object.entries(insights['🎯 KEY METRICS']).forEach(([key, value]) => {
        report += `${key}: ${value}\n`;
    });
    report += `\n`;
    Object.entries(insights['🏆 TOP PERFORMERS']).forEach(([key, value]) => {
        report += `${key}: ${value}\n`;
    });
    
    report += `\n${'='.repeat(60)}\n`;
    report += `End of Report\n`;
    
    // Download as text file
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    alert('✅ Dashboard report exported successfully!');
}

console.log('✅ Admin Dashboard Sync System Loaded');
console.log('💡 Available commands:');
console.log('  - refreshDashboard() - Reload all dashboard data');
console.log('  - getDashboardSummary() - View complete summary');
console.log('  - getBusinessInsights() - View business insights');
console.log('  - quickStats() - Quick overview');
console.log('  - exportDashboardReport() - Export full report');

// ========================================
// PRODUCTS MANAGEMENT
// ========================================
function initializeProducts() {
    if (!window.location.pathname.includes('admin-products.html')) return;
    
    console.log('🔧 Initializing products page...');
    
    loadProducts();

    // 1. 搜索框 (ID 是正确的)
    const searchInput = document.getElementById('search-products');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    // 2. 修正分类筛选 ID: 从 category-filter 改为 filter-category
    const categoryFilter = document.getElementById('filter-category');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }
    
    // 3. 修正排序/库存筛选 ID: 从 sort-status 改为 filter-stock
    const stockFilter = document.getElementById('filter-stock');
    if (stockFilter) {
        stockFilter.addEventListener('change', applyFilters);
    }

    // 4. 绑定添加按钮
    const addBtn = document.getElementById('add-product-btn');
    if (addBtn) {
        addBtn.addEventListener('click', addNewProduct);
    }
}

async function loadProducts() {
    console.log('📦 Admin: Loading products...');
    
    try {
        productsData = await getAllProducts();
        
        if (productsData && productsData.length > 0) {
          // 💡 必须：强制将 ID 转为数字进行数学排序，否则 10 会排在 2 前面
          productsData.sort((a, b) => {
            const idA = parseInt(a.id);
            const idB = parseInt(b.id);
            return idA - idB;
          });

          filteredProducts = [...productsData];
          renderProductsTable();
          console.log("✅ 产品已按 ID 1-11 顺序排列");
        }
        
        // --- ✨ 核心修复：按数字 ID 排序 ---
        // 确保 a.id 和 b.id 都转成数字再相减
        productsData.sort((a, b) => Number(a.id) - Number(b.id));
        // ----------------------------------

        console.log(`✅ Loaded and Sorted ${productsData.length} products`);
        
        // 这里的备份也需要是排序后的
        filteredProducts = [...productsData];
        
        renderProductsTable();
        
        // 更新统计 (确保字段名匹配你的数据库: stock 或 Stock)
        const getS = (p) => Number(p.stock || p.Stock || 0);
        console.log('📊 Products Stats:', {
            total: productsData.length,
            inStock: productsData.filter(p => getS(p) > 10).length,
            lowStock: productsData.filter(p => getS(p) > 0 && getS(p) <= 10).length,
            outOfStock: productsData.filter(p => getS(p) === 0).length
        });
        
    } catch (error) {
        console.error('❌ Error loading products:', error);
        productsData = [];
        filteredProducts = [];
        renderProductsTable();
    }
}

async function getAllProducts() {
    console.log('🔍 Fetching products from Firebase...');
    try {
        if (window.db && window.productsCollection) {
            const querySnapshot = await window.getDocs(window.productsCollection);
            const products = [];
            
            querySnapshot.forEach((doc) => {
                const docData = doc.data(); // 获取文档内容
                products.push({ 
                    ...docData,      // 这里面包含你的数字 id: 3
                    fireId: doc.id   // 💡 重点：把长ID存为 fireId 备用
                });
            });
            return products;
        }
        return [];
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}

function updateProductStats() {
    const data = productsData || [];
    
    let total = data.length;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    data.forEach(p => {
        // 强制转换类型，兼容 p.stock 或 p.Stock
        const s = Number(p.stock !== undefined ? p.stock : (p.Stock || 0));
        
        if (s > 10) inStock++;
        else if (s > 0 && s <= 10) lowStock++;
        else outOfStock++;
    });

    // 更新页面展示
    const updateText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    updateText('stats-total', total);
    updateText('stats-in-stock', inStock);
    updateText('stats-low-stock', lowStock);
    updateText('stats-out-stock', outOfStock);
    
    console.log(`📊 Stats updated: Total ${total}, In Stock ${inStock}, Low ${lowStock}, Out ${outOfStock}`);
}

// ADD NEW PRODUCT (UPDATED)
function addNewProduct() {
    showAddProductModal();
}

// Show Add Product Modal
function showAddProductModal() {
    const modal = document.createElement('div');
    modal.className = 'product-modal-overlay';
    modal.id = 'addProductModal';
    
    modal.innerHTML = `
        <div class="product-modal">
            <div class="product-modal-header">
                <h2>Add New Product</h2>
                <button class="modal-close-btn" onclick="closeProductModal()">×</button>
            </div>
            
            <div class="product-modal-body">
                <form id="addProductForm" onsubmit="submitNewProduct(event)">
                    
                    <!-- Product Image Upload -->
                    <div class="form-group">
                        <label>Product Image</label>
                        <div class="image-upload-container">
                            <div class="image-preview" id="imagePreview">
                                <span class="upload-placeholder">📷 Click to upload image</span>
                            </div>
                            <input type="file" id="productImage" accept="image/*" onchange="previewProductImage(event)" style="display: none;">
                            <button type="button" class="btn-upload" onclick="document.getElementById('productImage').click()">
                                Choose Image
                            </button>
                            <small>Supported: JPG, PNG, JPEG (Max 5MB)</small>
                        </div>
                    </div>
                    
                    <!-- Product Name -->
                    <div class="form-group">
                        <label for="productName">Product Name *</label>
                        <input type="text" id="productName" required placeholder="e.g., Biskut Chocolate Chip">
                    </div>
                    
                    <!-- Category -->
                    <div class="form-group">
                        <label for="productCategory">Category *</label>
                        <select id="productCategory" required>
                            <option value="">-- Select Category --</option>
                            <option value="cookies">Traditional Biscuits</option>
                            <option value="snacks">Snacks & Crackers</option>
                            <option value="cakes">Layered Cakes</option>
                        </select>
                    </div>
                    
                    <!-- Price and Stock Row -->
                    <div class="form-row">
                        <div class="form-group">
                            <label for="productPrice">Price (RM) *</label>
                            <input type="number" id="productPrice" step="0.01" min="0" required placeholder="25.00">
                        </div>
                        
                        <div class="form-group">
                            <label for="productStock">Stock Quantity *</label>
                            <input type="number" id="productStock" min="0" required placeholder="100">
                        </div>
                    </div>
                    
                    <!-- Description -->
                    <div class="form-group">
                        <label for="productDescription">Description</label>
                        <textarea id="productDescription" rows="3" placeholder="Enter product description..."></textarea>
                    </div>
                    
                    <!-- Has Variants Checkbox -->
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="hasVariants" onchange="toggleVariantsSection()">
                            <span>This product has variants (e.g., Regular/Premium)</span>
                        </label>
                    </div>
                    
                    <!-- Variants Section (Hidden by default) -->
                    <div id="variantsSection" style="display: none;">
                        <div class="variants-header">
                            <h4>Product Variants</h4>
                            <button type="button" class="btn-add-variant" onclick="addVariantField()">+ Add Variant</button>
                        </div>
                        <div id="variantsList"></div>
                    </div>
                    
                    <!-- Form Actions -->
                    <div class="product-modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeProductModal()">Cancel</button>
                        <button type="submit" class="btn-save">Add Product</button>
                    </div>
                    
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// Preview Product Image
function previewProductImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        event.target.value = '';
        return;
    }
    
    // Validate file type
    if (!file.type.match('image.*')) {
        alert('Please select a valid image file');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
}

// Toggle Variants Section
function toggleVariantsSection() {
    const hasVariants = document.getElementById('hasVariants').checked;
    const variantsSection = document.getElementById('variantsSection');
    
    if (hasVariants) {
        variantsSection.style.display = 'block';
        // Add first variant field automatically
        if (document.getElementById('variantsList').children.length === 0) {
            addVariantField();
        }
    } else {
        variantsSection.style.display = 'none';
        document.getElementById('variantsList').innerHTML = '';
    }
}

// Add Variant Field
let variantCounter = 0;
function addVariantField() {
    variantCounter++;
    const variantsList = document.getElementById('variantsList');
    
    const variantDiv = document.createElement('div');
    variantDiv.className = 'variant-item';
    variantDiv.id = `variant-${variantCounter}`;
    variantDiv.innerHTML = `
        <div class="variant-fields">
            <input type="text" placeholder="Variant name (e.g., Regular)" class="variant-name" required>
            <input type="number" step="0.01" min="0" placeholder="Price (RM)" class="variant-price" required>
            <button type="button" class="btn-remove-variant" onclick="removeVariant(${variantCounter})">×</button>
        </div>
    `;
    
    variantsList.appendChild(variantDiv);
}

// Remove Variant Field
function removeVariant(variantId) {
    const variantDiv = document.getElementById(`variant-${variantId}`);
    if (variantDiv) {
        variantDiv.remove();
    }
}

// Close Product Modal
function closeProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    variantCounter = 0;
}

// Submit New Product
function submitNewProduct(event) {
    event.preventDefault();
    
    const name = document.getElementById('productName').value.trim();
    const categoryId = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const stock = parseInt(document.getElementById('productStock').value);
    const description = document.getElementById('productDescription').value.trim();
    const hasVariants = document.getElementById('hasVariants').checked;
    
    // Get category name
    const categoryMap = {
        'cookies': 'Traditional Biscuits',
        'snacks': 'Snacks & Crackers',
        'cakes': 'Layered Cakes'
    };
    const categoryName = categoryMap[categoryId];
    
    // Get image
    const imageFile = document.getElementById('productImage').files[0];
    let imagePath = null;
    
    if (imageFile) {
        // For demo purposes, store as data URL
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePath = e.target.result;
            saveProduct();
        };
        reader.readAsDataURL(imageFile);
    } else {
        saveProduct();
    }
    
    function saveProduct() {
        // Collect variants if applicable
        let variants = [];
        if (hasVariants) {
            const variantItems = document.querySelectorAll('.variant-item');
            variantItems.forEach(item => {
                const variantName = item.querySelector('.variant-name').value.trim();
                const variantPrice = parseFloat(item.querySelector('.variant-price').value);
                if (variantName && !isNaN(variantPrice)) {
                    variants.push({ name: variantName, price: variantPrice });
                }
            });
            
            if (variants.length === 0) {
                alert('Please add at least one variant or uncheck "Has Variants"');
                return;
            }
        }
        
        // Create product data
        const productData = {
            name: name,
            category: categoryName,
            categoryId: categoryId,
            price: price,
            stock: stock,
            description: description || `Delicious ${name} made fresh daily.`,
            image: imagePath,
            hasVariants: hasVariants,
            variants: variants,
            features: [
                '✓ Fresh ingredients',
                '✓ Handmade with love',
                '✓ Halal certified',
                '✓ Perfect for any occasion'
            ]
        };
        
        // Add to database
        const newProduct = addNewProductToDatabase(productData);
        
        if (newProduct) {
            showToast(`✅ ${name} added successfully!`, 'success', 3000);
            closeProductModal();
            loadProducts(); // Reload the table
        } else {
            alert('❌ Failed to add product');
        }
    }
}

async function addNewProductToDatabase(productData) {
    try {
        const { addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
        
        // 确保关键数值是数字类型，防止统计显示为 0
        const dataToSave = {
            ...productData,
            price: Number(productData.price) || 0,
            stock: Number(productData.stock) || 0,
            id: Date.now().toString(), // 生成一个临时的唯一ID
            createdAt: serverTimestamp(),
            updatedAt: new Date().toISOString()
        };

        // window.productsCollection 是你在 HTML 模块脚本中定义的
        const docRef = await addDoc(window.productsCollection, dataToSave);
        console.log("Document written with ID: ", docRef.id);
        return true;
    } catch (error) {
        console.error("Error adding document: ", error);
        return false;
    }
}

//🔍 辅助函数：从当前加载的数据中通过 ID 查找产品
function getProductById(productId) {
    // 确保与你的渲染逻辑一致，productId 可能是数字或字符串
    return productsData.find(p => String(p.id) === String(productId));
}

async function editProduct(numericId) {
    // 1. 在本地找到该产品
    const product = productsData.find(p => String(p.id) === String(numericId));
    if (!product) return;

    // 2. 依次询问要修改的内容（临时方案，后续可以用 Modal 弹窗）
    const newName = prompt("Edit Name:", product.name);
    if (newName === null) return; // 取消则退出

    const newPrice = prompt("Edit Price (RM):", product.price || product.Price);
    if (newPrice === null) return;

    const newStock = prompt("Edit Stock Units:", product.stock || product.Stock);
    if (newStock === null) return;

    // 3. 构建更新对象
    const updatedFields = {
        name: newName,
        price: parseFloat(newPrice), // 确保转成数字
        stock: parseInt(newStock, 10), // 确保转成数字
        updatedAt: new Date().toISOString()
    };

    // 4. 调用更新函数
    const success = await updateProductInFirebase(numericId, updatedFields);

    if (success) {
        // 5. 同步本地显示数据
        Object.assign(product, updatedFields);
        applyFilters(); // 重新渲染表格
        alert("✅ Product updated successfully!");
    }
}

// 修正后的删除函数
async function deleteProduct(productId) {
    const product = getProductById(productId);
    if (!product) return;
    
    if (!confirm(`⚠️ Confirm delete: ${product.name}?`)) return;
    
    const success = await deleteProductFromDatabase(productId);
    
    if (success) {
        alert('✅ Product deleted successfully!');
        loadProducts(); 
    } else {
        alert('❌ Failed to delete product');
    }
}

async function updateProductInFirebase(numericId, updatedData) {
    try {
        const product = productsData.find(p => String(p.id) === String(numericId));
        if (!product || !product.fireId) return false;

        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
        const productRef = doc(window.db, "products", product.fireId);
        
        // ✨ updatedData 包含了你在上面传进来的 name, price, stock
        await updateDoc(productRef, updatedData);
        return true;
    } catch (error) {
        console.error("Update failed:", error);
        return false;
    }
}

// 🗑️ 删除产品 (Firebase 版)
async function deleteProductFromDatabase(productId) {
    try {
        const docRef = window.doc(window.db, "products", String(productId));
        await window.deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting product:", error);
        return false;
    }
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  
  if (filteredProducts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #999;">No products found. Click "Add New Product" to get started.</td></tr>`;
    updateProductStats();
    return;
  }
  
  tbody.innerHTML = filteredProducts.map(product => {
    // ✅ 修复点 1：安全获取数值字段 (防止 undefined)
    const stock = Number(product.stock !== undefined ? product.stock : (product.Stock || 0));
    const price = Number(product.price !== undefined ? product.price : (product.Price || 0));
    const name = product.name || product.Name || "Unnamed Product";
    const category = product.category || product.Category || "Uncategorized";

    const lastUpdated = product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-US') : 'N/A';
    
    let imagePath = product.image || '';
    if (!imagePath.startsWith('../') && imagePath !== '' && !imagePath.startsWith('data:')) {
      imagePath = '../' + imagePath;
    }
    
    return `
      <tr>
        <td><strong>${product.id}</strong></td>
        <td>
          ${imagePath ? `<img src="${imagePath}" alt="${name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" onerror="this.onerror=null; this.src='../asset/placeholder.png';">` : '📦'}
        </td>
        <td><strong>${name}</strong></td>
        <td>${capitalizeFirst(category)}</td>
        <td><strong>RM ${price.toFixed(2)}</strong></td>
        <td>
          <span class="stock-indicator ${getStockClass(stock)}">
            ${stock} units
          </span>
        </td>
        <td>
          <span class="status-badge ${getStockStatusClass(stock)}">
            ${getStockStatus(stock)}
          </span>
        </td>
        <td><small>${lastUpdated}</small></td>
        <td>
          <button class="edit-btn" onclick="editProduct('${product.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteProduct('${product.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
  
  updateProductStats();
}

function getStockClass(stock) {
  if (stock === 0) return 'stock-out';
  if (stock < 10) return 'stock-low';
  return 'stock-in';
}

function getStockStatus(stock) {
  if (stock === 0) return 'Out of Stock';
  if (stock < 10) return 'Low Stock';
  return 'In Stock';
}

function getStockStatusClass(stock) {
  if (stock === 0) return 'status-out-of-stock';
  if (stock < 10) return 'status-low-stock';
  return 'status-in-stock';
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function applyFilters() {
    const searchQuery = document.getElementById('search-products')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('filter-category')?.value || '';
    const stockFilter = document.getElementById('filter-stock')?.value || '';

    // 💡 必须：每次筛选都从全量原始数据 productsData 开始
    let results = [...productsData];

    // 分类筛选
    if (categoryFilter !== "") {
        results = results.filter(p => {
            const pCat = (p.category || "").toLowerCase();
            const pCatId = (p.categoryId || "").toLowerCase();
            return pCat === categoryFilter.toLowerCase() || pCatId === categoryFilter.toLowerCase();
        });
    }

    // 搜索过滤
    if (searchQuery) {
        results = results.filter(p => 
            (p.name || "").toLowerCase().includes(searchQuery) || 
            (p.id || "").toString().toLowerCase().includes(searchQuery)
        );
    }

    // 库存过滤
    if (stockFilter) {
        results = results.filter(p => {
            const s = Number(p.stock || 0); // 强制转数字判断
            if (stockFilter === 'in-stock') return s > 10;
            if (stockFilter === 'low-stock') return s > 0 && s <= 10;
            if (stockFilter === 'out-of-stock') return s === 0;
            return true;
        });
    }

    filteredProducts = results;
    renderProductsTable();
}

// ========================================
// ORDERS MANAGEMENT
// ========================================
let ordersData = [];
let filteredOrders = [];

function initializeOrders() {
  if (!window.location.pathname.includes('admin-orders.html')) return;
  
  loadOrders();
  
  const exportBtn = document.getElementById('export-orders-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportOrders);
  }
  
  const searchInput = document.getElementById('search-orders');
  if (searchInput) {
    searchInput.addEventListener('input', applyOrderFilters);
  }
  
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyOrderFilters);
  }
  
  const dateFromFilter = document.getElementById('filter-date-from');
  const dateToFilter = document.getElementById('filter-date-to');
  
  if (dateFromFilter) {
    dateFromFilter.addEventListener('change', applyOrderFilters);
  }
  if (dateToFilter) {
    dateToFilter.addEventListener('change', applyOrderFilters);
  }
}

async function loadOrders() {
  console.log('🔥 正在从 Firebase 加载订单...');
  ordersData = [];

  try {
    // 1. 获取 Firebase 集合引用
    const { collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
    const ordersCol = collection(window.db, "orders");
    
    // 2. 按下单时间排序（使用你截图中的 orderDate 字段）
    const q = query(ordersCol, orderBy("orderDate", "desc"));
    const querySnapshot = await getDocs(q);

    // 3. 解析并映射数据
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      ordersData.push({
        fireId: doc.id, // 用于更新状态或删除
        id: data.orderId || `ORD-${doc.id.substring(0, 5).toUpperCase()}`,
        customer: data.name || "Unknown",
        customerEmail: data.email || "N/A",
        products: data.cart || [], // 对应你截图中的 cart 数组
        total: Number(data.total || data.subtotal + (data.shipping || 0)),
        payment: data.paymentCompleted ? 'paid' : 'pending',
        status: data.status || 'pending',
        date: data.orderDate || data.createdAt,
        shippingAddress: data.address || 'No Address',
        paymentMethod: data.paymentMethod || 'N/A'
      });
    });

    console.log(`✅ 成功加载 ${ordersData.length} 个订单`);
    
    filteredOrders = [...ordersData];
    renderOrdersTable(); // 渲染表格

  } catch (error) {
    console.error("❌ Firebase 订单加载失败:", error);
    // fallback: 如果报错，显示空表
    renderOrdersTable();
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;
  
  if (filteredOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #999;">
          No orders found.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filteredOrders.map(order => `
    <tr>
      <td><strong>${order.id}</strong></td>
      <td>
        ${order.customer}<br>
        <small style="color: #666;">${order.customerEmail}</small>
      </td>
      <td>
        <small>${order.products.length} item${order.products.length > 1 ? 's' : ''}</small>
      </td>
      <td><strong>RM ${order.total.toFixed(2)}</strong></td>
      <td>
        <span class="status-badge ${order.payment === 'paid' ? 'status-delivered' : 'status-pending'}">
          ${capitalizeFirst(order.payment)}
        </span>
      </td>
      <td>
        <span class="status-badge status-${order.status}">
          ${capitalizeFirst(order.status)}
        </span>
      </td>
      <td>${formatDate(order.date)}</td>
      <td>
        <button class="view-btn" onclick="viewOrderDetails('${order.fireId}')">View</button>
        <button class="edit-btn" onclick="updateOrderStatus('${order.fireId}')">Update</button>
        <button class="delete-btn" onclick="deleteOrder('${order.fireId}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function markOrderAsShipped(orderId) {
    // Find the order across all customers
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key.startsWith('orderHistory_')) {
            const customerEmail = key.replace('orderHistory_', '');
            let orderHistory = JSON.parse(localStorage.getItem(key)) || [];
            
            // Find the order in this customer's history
            const orderIndex = orderHistory.findIndex(order => {
                const generatedId = `ORD-${customerEmail.substring(0, 3).toUpperCase()}-${Date.parse(order.time)}`;
                return generatedId === orderId;
            });
            
            if (orderIndex !== -1) {
                // ✅ Update status to SHIPPED
                orderHistory[orderIndex].status = ORDER_STATUS.SHIPPED;
                orderHistory[orderIndex].shippedAt = new Date().toLocaleString();
                
                // Save tracking info (from your existing modal)
                orderHistory[orderIndex].trackingInfo = {
                    trackingNumber: document.getElementById('trackingNumber').value,
                    carrier: document.getElementById('carrier').value,
                    shippedFrom: document.getElementById('fromLocation').value,
                    shippedTo: document.getElementById('toLocation').value
                };
                
                localStorage.setItem(key, JSON.stringify(orderHistory));
                
                alert(`✅ Order ${orderId} marked as SHIPPED!\n\nCustomer will see status update in their tracking page.`);
                
                // Reload orders table
                loadOrders();
                closeTrackingModal();
                return;
            }
        }
    }
    
    alert('Order not found');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function applyOrderFilters() {
  const searchQuery = document.getElementById('search-orders')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const dateFrom = document.getElementById('filter-date-from')?.value || '';
  const dateTo = document.getElementById('filter-date-to')?.value || '';
  
  let filtered = [...ordersData];
  
  if (searchQuery) {
    filtered = filtered.filter(order => 
      order.id.toLowerCase().includes(searchQuery) ||
      order.customer.toLowerCase().includes(searchQuery) ||
      order.customerEmail.toLowerCase().includes(searchQuery)
    );
  }
  
  if (statusFilter) {
    filtered = filtered.filter(order => order.status === statusFilter);
  }
  
  if (dateFrom) {
    filtered = filtered.filter(order => new Date(order.date) >= new Date(dateFrom));
  }
  
  if (dateTo) {
    filtered = filtered.filter(order => new Date(order.date) <= new Date(dateTo));
  }
  
  filteredOrders = filtered;
  renderOrdersTable();
}

window.viewOrderDetails = function(fireId) {
  // 💡 关键修复：使用 fireId 在 ordersData 数组中查找
  const order = ordersData.find(o => o.fireId === fireId);
  
  if (!order) {
    alert('Order not found in memory.');
    return;
  }
  
  // 处理产品列表显示
  const productsList = (order.products || []).map(p => 
    `- ${p.name || 'Product'} (x${p.quantity || 1}) - RM ${((p.price || 0) * (p.quantity || 1)).toFixed(2)}`
  ).join('\n');
  
  const orderDetails = `
  Order ID: ${order.id}
  Customer: ${order.customer}
  Email: ${order.customerEmail}
  Status: ${order.status.toUpperCase()}
  Payment: ${order.payment.toUpperCase()}
  Date: ${typeof formatDate === 'function' ? formatDate(order.date) : order.date}

  Products:
  ${productsList}

  Total: RM ${Number(order.total || 0).toFixed(2)}

  Shipping Address:
  ${order.shippingAddress || 'Not provided'}
    `;
    
  alert(orderDetails);
};

window.updateOrderStatus = async function(fireId) {
    console.log("Updating Firebase Document ID:", fireId);
    
    const newStatus = prompt("Enter new status (pending, processing, completed, cancelled):");
    if (!newStatus) return;

    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
        
        // 使用 window.db 确保数据库连接存在
        const orderRef = doc(window.db, "orders", fireId);

        await updateDoc(orderRef, {
            status: newStatus.toLowerCase(),
            updatedAt: new Date().toISOString()
        });

        alert("✅ Status updated successfully!");
        
        // 🛠️ 重新从 Firebase 加载最新数据并刷新表格
        if (typeof loadOrders === 'function') {
            await loadOrders(); 
        } else {
            location.reload(); // 如果 loadOrders 不可用，则刷新页面
        }
    } catch (error) {
        console.error("Error updating order:", error);
        alert("❌ Update failed: " + error.message);
    }
};

function showTrackingModal(order) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'tracking-modal-overlay';
  modal.id = 'trackingModal';
  
  modal.innerHTML = `
    <div class="tracking-modal">
      <div class="tracking-modal-header">
        <h2>Update Shipping Status - ${order.id}</h2>
        <button class="modal-close-btn" onclick="closeTrackingModal()">×</button>
      </div>
      
      <div class="tracking-modal-body">
        <!-- Package Info Card -->
        <div class="package-info-card">
          <div class="package-icon">📦</div>
          <div class="package-details">
            <h3>${order.id}</h3>
            <p>Customer: ${order.customer}</p>
            <p>Email: ${order.customerEmail}</p>
            <p>${order.products.length} item(s) • RM ${order.total.toFixed(2)}</p>
          </div>
          <div class="package-status-badge status-${order.status}">
            ${capitalizeFirst(order.status)}
          </div>
        </div>
        
        <!-- Shipping Form -->
        <div class="shipping-form">
          <h3>Shipping Information</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>From Location</label>
              <input type="text" id="fromLocation" value="Kuching, Sarawak" required>
            </div>
            
            <div class="form-group">
              <label>To Location</label>
              <input type="text" id="toLocation" value="${order.shippingAddress || 'N/A'}" required>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Carrier</label>
              <select id="carrier">
                <option value="poslaju">Pos Laju</option>
                <option value="fedex">FedEx</option>
                <option value="dhl">DHL</option>
                <option value="gdex">GDEx</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Tracking Number</label>
              <input type="text" id="trackingNumber" placeholder="Enter tracking number" required>
            </div>
          </div>
          
          <div class="form-group">
            <label>Order Status</label>
            <select id="orderStatus" onchange="updateStatusPreview()">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Additional Notes</label>
            <textarea id="shippingNotes" rows="3" placeholder="Add any special notes or instructions..."></textarea>
          </div>
        </div>
        
        <!-- Status Preview -->
        <div class="status-preview" id="statusPreview">
          <h3>Status Badge Preview</h3>
          <span class="preview-badge status-${order.status}">TO BE SHIPPED</span>
        </div>
      </div>
      
      <div class="tracking-modal-footer">
        <button class="btn-cancel" onclick="closeTrackingModal()">Cancel</button>
        <button class="btn-save" onclick="saveShippingInfo('${order.id}')">Save & Update</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Prevent body scroll when modal is open
  document.body.style.overflow = 'hidden';
}

function closeTrackingModal() {
  const modal = document.getElementById('trackingModal');
  if (modal) {
    modal.remove();
    document.body.style.overflow = '';
  }
}

function updateStatusPreview() {
  const statusSelect = document.getElementById('orderStatus');
  const preview = document.getElementById('statusPreview');
  const selectedStatus = statusSelect.value;
  
  const statusTexts = {
    'pending': 'TO BE SHIPPED',
    'processing': 'PROCESSING',
    'shipped': 'SHIPPED',
    'delivered': 'DELIVERED',
    'cancelled': 'CANCELLED'
  };
  
  preview.querySelector('.preview-badge').className = `preview-badge status-${selectedStatus}`;
  preview.querySelector('.preview-badge').textContent = statusTexts[selectedStatus];
}

function saveShippingInfo(orderId) {
    const fromLocation = document.getElementById('fromLocation').value;
    const toLocation = document.getElementById('toLocation').value;
    const carrier = document.getElementById('carrier').value;
    const trackingNumber = document.getElementById('trackingNumber').value;
    const orderStatus = document.getElementById('orderStatus').value;
    const notes = document.getElementById('shippingNotes').value;
    
    if (!fromLocation || !toLocation || !trackingNumber) {
        alert('Please fill in all required fields');
        return;
    }
    
    // ✅ Update the order status across all customers
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key.startsWith('orderHistory_')) {
            const customerEmail = key.replace('orderHistory_', '');
            let orderHistory = JSON.parse(localStorage.getItem(key)) || [];
            
            const orderIndex = orderHistory.findIndex(order => {
                const generatedId = `ORD-${customerEmail.substring(0, 3).toUpperCase()}-${Date.parse(order.time)}`;
                return generatedId === orderId;
            });
            
            if (orderIndex !== -1) {
                // Update order status
                orderHistory[orderIndex].status = orderStatus;
                orderHistory[orderIndex].shippingInfo = {
                    fromLocation,
                    toLocation,
                    carrier,
                    trackingNumber,
                    notes,
                    updatedAt: new Date().toLocaleString()
                };
                
                // Add timestamp for when it was shipped
                if (orderStatus === ORDER_STATUS.SHIPPED) {
                    orderHistory[orderIndex].shippedAt = new Date().toLocaleString();
                }
                
                localStorage.setItem(key, JSON.stringify(orderHistory));
                
                closeTrackingModal();
                loadOrders();
                
                alert(`✅ Order ${orderId} updated to: ${orderStatus.toUpperCase()}\n\nTracking: ${trackingNumber}`);
                return;
            }
        }
    }
}

function deleteOrder(orderId) {
  const order = ordersData.find(o => o.id === orderId);
  if (!order) {
    alert('Order not found');
    return;
  }
  
  const confirmDelete = confirm(
    `Are you sure you want to delete order ${orderId}?\n\nCustomer: ${order.customer}\nTotal: RM ${order.total.toFixed(2)}\n\nThis action cannot be undone.`
  );
  
  if (!confirmDelete) return;
  
  ordersData = ordersData.filter(o => o.id !== orderId);
  filteredOrders = filteredOrders.filter(o => o.id !== orderId);
  
  renderOrdersTable();
  alert('Order deleted successfully!');
}

function exportOrders() {
  if (filteredOrders.length === 0) {
    alert('No orders to export');
    return;
  }
  
  const headers = ['Order ID', 'Customer', 'Email', 'Products', 'Total (RM)', 'Payment', 'Status', 'Date'];
  const csvContent = [
    headers.join(','),
    ...filteredOrders.map(order => {
      const productsText = order.products.map(p => `${p.name} (x${p.quantity})`).join('; ');
      return [
        order.id,
        `"${order.customer}"`,
        order.customerEmail,
        `"${productsText}"`,
        order.total.toFixed(2),
        order.payment,
        order.status,
        order.date
      ].join(',');
    })
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  alert(`Exported ${filteredOrders.length} orders successfully!`);
}

// ========================================
// CUSTOMERS MANAGEMENT
// ========================================
let customersData = [];
let filteredCustomers = [];

function initializeCustomers() {
  if (!window.location.pathname.includes('admin-customers.html')) return;
  
  loadCustomers();
  
  const exportBtn = document.getElementById('export-customers-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCustomers);
  }
  
  const searchInput = document.getElementById('search-customers');
  if (searchInput) {
    searchInput.addEventListener('input', applyCustomerFilters);
  }
  
  const typeFilter = document.getElementById('filter-customer-type');
  if (typeFilter) {
    typeFilter.addEventListener('change', applyCustomerFilters);
  }
}

async function loadCustomers() {
    console.log('👥 正在从 Firebase 提取客户资料...');
    customersData = [];
    const customerMap = new Map(); // 用于去重

    try {
        if (!window.db) return;

        // 1. 从 Firebase 获取所有订单
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
        const ordersSnapshot = await getDocs(window.ordersCollection);

        ordersSnapshot.forEach((doc) => {
            const data = doc.data();
            const email = data.email || data.customerEmail;
            if (!email) return;

            const orderTotal = Number(data.total || (data.subtotal + (data.shipping || 0)) || 0);
            const orderDate = data.orderDate || data.createdAt || new Date().toISOString();

            // 2. 如果是新客户，创建资料；如果是老客户，累计消费
            if (!customerMap.has(email)) {
                customerMap.set(email, {
                    id: 'CUST-' + email.substring(0, 5).toUpperCase(),
                    name: data.name || 'Guest',
                    email: email,
                    phone: data.phone || 'N/A',
                    totalOrders: 1,
                    totalSpent: orderTotal,
                    joined: orderDate,
                    lastOrder: orderDate,
                    address: data.address || 'No Address',
                    type: 'regular'
                });
            } else {
                const existing = customerMap.get(email);
                existing.totalOrders += 1;
                existing.totalSpent += orderTotal;
                if (new Date(orderDate) > new Date(existing.lastOrder)) {
                    existing.lastOrder = orderDate;
                }
            }
        });

        // 3. 将 Map 转换为数组并根据订单数更新等级
        customersData = Array.from(customerMap.values()).map(c => {
            if (c.totalOrders >= 5) c.type = 'vip';
            else if (c.totalOrders < 1) c.type = 'new';
            else c.type = 'regular';
            return c;
        });

        // 4. 按总消费排序并渲染
        customersData.sort((a, b) => b.totalSpent - a.totalSpent);
        filteredCustomers = [...customersData];
        
        renderCustomersTable();
        updateCustomerStats();
        console.log(`✅ 成功从云端加载 ${customersData.length} 位客户`);

    } catch (error) {
        console.error("❌ Firebase 客户加载失败:", error);
    }
}

function renderCustomersTable() {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;
    
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: #999;">
                    No customers found.
                </td>
            </tr>
        `;
        updateCustomerStats();
        return;
    }
    
    tbody.innerHTML = filteredCustomers.map(customer => `
        <tr>
            <td><strong>${customer.id}</strong></td>
            <td>${customer.name}</td>
            <td>
                <a href="mailto:${customer.email}" style="color: #8b4513; text-decoration: none;">
                    ${customer.email}
                </a>
            </td>
            <td>${customer.phone}</td>
            <td><strong>${customer.totalOrders}</strong></td>
            <td><strong>RM ${customer.totalSpent.toFixed(2)}</strong></td>
            <td>
                <span class="status-badge ${getCustomerTypeClass(customer.type)}">
                    ${capitalizeFirst(customer.type)}
                </span>
            </td>
            <td>${formatDate(customer.joined)}</td>
            <td>
                <button class="view-btn" onclick="viewCustomerDetails('${customer.id}')">View</button>
                <button class="delete-btn" onclick="deleteCustomer('${customer.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
    
    updateCustomerStats();
}

function updateCustomerStats() {
    // 获取页面上的显示元素
    const totalCustomersEl = document.getElementById('total-customers');
    const vipCountEl = document.getElementById('vip-count'); // 如果你有这个 ID
    
    if (totalCustomersEl) {
        totalCustomersEl.textContent = customersData.length;
    }

    // 可选：计算 VIP 人数
    const vipCount = customersData.filter(c => c.type === 'vip').length;
    if (vipCountEl) vipCountEl.textContent = vipCount;
}

function getCustomerTypeClass(type) {
  switch(type) {
    case 'vip':
      return 'status-delivered';
    case 'new':
      return 'status-processing';
    case 'regular':
    default:
      return 'status-pending';
  }
}

function applyCustomerFilters() {
    // 💡 必须：每次过滤都重置数据源
    let results = [...customersData]; 

    const searchQuery = document.getElementById('search-customers')?.value.toLowerCase().trim() || '';
    const typeFilter = document.getElementById('filter-customer-type')?.value || '';
    
    // 1. 关键词过滤 (支持 ID, 姓名, 邮箱, 电话)
    if (searchQuery) {
        results = results.filter(customer => 
            (customer.name || "").toLowerCase().includes(searchQuery) ||
            (customer.email || "").toLowerCase().includes(searchQuery) ||
            (customer.phone || "").toLowerCase().includes(searchQuery) ||
            (customer.id || "").toLowerCase().includes(searchQuery)
        );
    }
    
    // 2. 类型过滤 (New/Regular/VIP)
    if (typeFilter && typeFilter !== "") {
        results = results.filter(customer => customer.type === typeFilter);
    }
    
    filteredCustomers = results;
    renderCustomersTable(); // 重新渲染表格
}

window.viewCustomerDetails = function(customerId) {
    const customer = customersData.find(c => c.id === customerId);
    if (!customer) return alert('Customer not found');

    // 💡 关键：avgOrderValue 使用已有的云端统计数据
    const avgOrderValue = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;

    const customerDetails = `
    ╔════════════════════════════════════════╗
    ║          CUSTOMER DETAILS              ║
    ╚════════════════════════════════════════╝

    📋 BASIC INFO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ID: ${customer.id}
    Name: ${customer.name}
    Email: ${customer.email}
    Phone: ${customer.phone}

    👤 CUSTOMER TYPE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Status: ${customer.type.toUpperCase()}
    Member Since: ${new Date(customer.joined).toLocaleDateString()}
    Last Order: ${customer.lastOrder ? new Date(customer.lastOrder).toLocaleDateString() : 'No orders yet'}

    💰 PURCHASE HISTORY
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Total Orders: ${customer.totalOrders}
    Total Spent: RM ${customer.totalSpent.toFixed(2)}
    Avg Order Value: RM ${avgOrderValue.toFixed(2)}

    📍 LAST DELIVERY ADDRESS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ${customer.address}
    `;
    
    alert(customerDetails);
};

window.editCustomer = async function(customerId) {
  const customer = customersData.find(c => c.id === customerId);
  if (!customer) return alert('Customer not found');
  
  const newName = prompt('Edit customer name:', customer.name);
  if (!newName) return;
  
  // 更新本地数组以实时反映在 UI 上
  customer.name = newName;
  customer.type = prompt('Edit type (regular/vip/new):', customer.type) || customer.type;

  applyCustomerFilters();
  alert('Local display updated! (Note: Core order data remains in Firebase)');
};

function deleteCustomer(customerId) {
    const customer = customersData.find(c => c.id === customerId);
    if (!customer) {
        alert('Customer not found');
        return;
    }
    
    const confirmDelete = confirm(
        `⚠️ DELETE CUSTOMER ACCOUNT?\n\n` +
        `Customer: ${customer.name}\n` +
        `Email: ${customer.email}\n` +
        `Total Orders: ${customer.totalOrders}\n` +
        `Total Spent: RM ${customer.totalSpent.toFixed(2)}\n\n` +
        `This will permanently delete:\n` +
        `• Customer account\n` +
        `• Order history (${customer.totalOrders} orders)\n` +
        `• All customer data\n\n` +
        `⚠️ THIS CANNOT BE UNDONE!\n\n` +
        `Type the customer's email to confirm deletion.`
    );
    
    if (!confirmDelete) return;
    
    const emailConfirm = prompt(`Type "${customer.email}" to confirm deletion:`);
    
    if (emailConfirm !== customer.email) {
        alert('❌ Email does not match. Deletion cancelled.');
        return;
    }
    
    // Delete customer data
    const userKey = 'registeredUser_' + customer.email;
    const orderKey = 'orderHistory_' + customer.email;
    const cartKey = 'cart_' + customer.email;
    const wishlistKey = 'wishlist_' + customer.email;
    const addressKey = 'savedAddresses_' + customer.email;
    const customerTrackingKey = 'customer_' + customer.email;
    
    localStorage.removeItem(userKey);
    localStorage.removeItem(orderKey);
    localStorage.removeItem(cartKey);
    localStorage.removeItem(wishlistKey);
    localStorage.removeItem(addressKey);
    localStorage.removeItem(customerTrackingKey);
    
    // Remove from arrays
    customersData = customersData.filter(c => c.id !== customerId);
    filteredCustomers = filteredCustomers.filter(c => c.id !== customerId);
    
    renderCustomersTable();
    alert(`✅ Customer "${customer.name}" has been permanently deleted.`);
}

function exportCustomers() {
    if (filteredCustomers.length === 0) {
        alert('No customers to export');
        return;
    }
    
    const headers = [
        'Customer ID', 
        'Name', 
        'Email', 
        'Phone', 
        'Total Orders', 
        'Total Spent (RM)', 
        'Type', 
        'Joined Date',
        'Last Order',
        'Address'
    ];
    
    const csvContent = [
        headers.join(','),
        ...filteredCustomers.map(customer => [
            customer.id,
            `"${customer.name}"`,
            customer.email,
            customer.phone,
            customer.totalOrders,
            customer.totalSpent.toFixed(2),
            customer.type,
            customer.joined,
            customer.lastOrder || 'N/A',
            `"${customer.address}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    alert(`✅ Exported ${filteredCustomers.length} customers successfully!`);
}

function viewCustomerOrderHistory(customerId) {
    const customer = customersData.find(c => c.id === customerId);
    if (!customer) {
        alert('Customer not found');
        return;
    }
    
    const orderKey = 'orderHistory_' + customer.email;
    const orderHistory = JSON.parse(localStorage.getItem(orderKey)) || [];
    
    if (orderHistory.length === 0) {
        alert(`${customer.name} has no orders yet.`);
        return;
    }
    
    // Create order history summary
    let orderSummary = `📦 ORDER HISTORY - ${customer.name}\n`;
    orderSummary += `${'='.repeat(50)}\n\n`;
    
    orderHistory.reverse().forEach((order, index) => {
        orderSummary += `Order #${index + 1}\n`;
        orderSummary += `Date: ${order.time}\n`;
        orderSummary += `Total: RM ${order.total.toFixed(2)}\n`;
        orderSummary += `Status: ${(order.status || 'completed').toUpperCase()}\n`;
        orderSummary += `Payment: ${order.paymentMethod || 'N/A'}\n`;
        orderSummary += `Items: ${order.cart.length} product(s)\n`;
        orderSummary += `${'-'.repeat(50)}\n`;
    });
    
    alert(orderSummary);
}

// ADD utility function to get customer statistics:
function getCustomerStatistics() {
    const stats = {
        total: customersData.length,
        new: customersData.filter(c => c.type === 'new').length,
        regular: customersData.filter(c => c.type === 'regular').length,
        vip: customersData.filter(c => c.type === 'vip').length,
        totalRevenue: customersData.reduce((sum, c) => sum + c.totalSpent, 0),
        avgOrderValue: 0,
        totalOrders: customersData.reduce((sum, c) => sum + c.totalOrders, 0)
    };
    
    stats.avgOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
    
    return stats;
}

// ADD function to display customer stats:
function displayCustomerStats() {
    const stats = getCustomerStatistics();
    
    console.log('👥 CUSTOMER STATISTICS');
    console.log('═══════════════════════════════════════');
    console.table({
        'Total Customers': stats.total,
        'New Customers': stats.new,
        'Regular Customers': stats.regular,
        'VIP Customers': stats.vip,
        'Total Orders': stats.totalOrders,
        'Total Revenue': `RM ${stats.totalRevenue.toFixed(2)}`,
        'Avg Order Value': `RM ${stats.avgOrderValue.toFixed(2)}`
    });
}


// ========================================
// ANALYTICS FUNCTIONS
// ========================================
let revenueChart, ordersChart, productsChart, customersChart;

async function initializeAnalytics() {
  if (!window.location.pathname.includes('admin-analytics.html')) return;
  
  // 1. 先初始化图表的静态外壳（背景、坐标轴等）
  initializeCharts();
  
  // 2. 💡 关键：立即异步加载 Firebase 数据并填充图表
  // 默认加载 30 天的数据
  await updateChartsData('30days'); 
  
  // 3. 💡 关键：立即异步加载指标卡片数据（RM 28.00 那些）
  await loadMetrics(); 
  
  const timeRangeSelect = document.getElementById('time-range');
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', function() {
      // 切换时间范围时重新拉取数据
      updateChartsData(this.value);
    });
  }
  
  const downloadBtn = document.getElementById('download-report-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadReport);
  }
}

function initializeCharts() {
  initRevenueChart();
  initOrdersChart();
  initProductsChart();
  initCustomersChart();
}

function initRevenueChart() {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;
  
  revenueChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Revenue (RM)',
        data: [0, 0, 0, 0],
        borderColor: '#8b4513',
        backgroundColor: 'rgba(212,165,116,0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'RM ' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return 'RM ' + value;
            }
          }
        }
      }
    }
  });
}

function initOrdersChart() {
  const ctx = document.getElementById('ordersChart');
  if (!ctx) return;
  
  ordersChart = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      datasets: [{
        label: 'Orders',
        data: [0, 0, 0, 0, 0],
        backgroundColor: [
          '#FFC107',
          '#2196F3',
          '#9C27B0',
          '#4CAF50',
          '#F44336'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function initProductsChart() {
  const ctx = document.getElementById('productsChart');
  if (!ctx) return;
  
  productsChart = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['No Data'],
      datasets: [{
        data: [1],
        backgroundColor: ['#ddd'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function initCustomersChart() {
  const ctx = document.getElementById('customersChart');
  if (!ctx) return;
  
  customersChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'New Customers',
        data: [0, 0, 0, 0, 0, 0],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76,175,80,0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

async function updateChartsData(timeRange) {
    try {
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
        const querySnapshot = await getDocs(window.ordersCollection);
        
        // 数据容器初始化
        let revenueData = [0, 0, 0, 0]; // 对应 Week 1, 2, 3, 4
        let ordersStatusData = [0, 0, 0, 0, 0]; // Pending, Processing, Shipped, Delivered, Cancelled
        let productCounts = {};
        let customerGrowthData = [0, 0, 0, 0, 0, 0]; // Jan - Jun
        let uniqueEmails = new Set();

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const total = Number(data.total || (data.subtotal + data.shipping) || 0);
            
            // 💡 改进：解析日期并自动分配到对应的周
            const orderDate = new Date(data.orderDate || data.createdAt);
            const day = orderDate.getDate();
            const weekIndex = Math.min(Math.floor((day - 1) / 7), 3); // 0-7日为Week 1，以此类推
            revenueData[weekIndex] += total; 

            // 💡 改进：统计订单状态数据
            const status = (data.status || "pending").toLowerCase();
            if (status === 'pending') ordersStatusData[0]++;
            else if (status === 'processing') ordersStatusData[1]++;
            else if (status === 'shipped') ordersStatusData[2]++;
            else if (status === 'delivered' || status === 'completed') ordersStatusData[3]++;
            else if (status === 'cancelled') ordersStatusData[4]++;

            // 统计客户增长
            const monthIndex = orderDate.getMonth();
            const email = data.email || data.customerEmail;
            if (email && !uniqueEmails.has(email)) {
                uniqueEmails.add(email);
                if (monthIndex < 6) customerGrowthData[monthIndex]++;
            }

            // 统计产品销量
            if (data.cart) {
                data.cart.forEach(item => {
                    const productName = item.name || "Unknown Product";
                    productCounts[productName] = (productCounts[productName] || 0) + (item.quantity || 1);
                });
            }
        });

        // --- 刷新图表并应用颜色 ---

        // 1. Sales Revenue (折线图)
        if (revenueChart) {
            revenueChart.data.datasets[0].data = revenueData;
            revenueChart.update();
        }

        // 2. Orders Overview (柱状图) - ✨ 修复颜色
        if (ordersChart) {
            ordersChart.data.datasets[0].data = ordersStatusData;
            ordersChart.data.datasets[0].backgroundColor = [
                '#FFC107', '#2196F3', '#9C27B0', '#4CAF50', '#F44336'
            ]; // 确保颜色被应用
            ordersChart.update();
        }

        // 3. Top Products (饼图) - ✨ 修复颜色和标签
        if (productsChart && Object.keys(productCounts).length > 0) {
            productsChart.data.labels = Object.keys(productCounts);
            productsChart.data.datasets[0].data = Object.values(productCounts);
            productsChart.data.datasets[0].backgroundColor = [
                '#8b4513', '#d4a574', '#5d4037', '#a1887f', '#bc8f8f', '#deb887'
            ]; // 动态分配饼图颜色
            productsChart.update();
        }

        // 4. Customer Growth (折线图)
        if (customersChart) {
            customersChart.data.datasets[0].data = customerGrowthData;
            customersChart.update();
        }

        console.log("📊 所有图表已成功同步 Firebase 数据并上色");

    } catch (e) {
        console.error("Chart update failed:", e);
    }
}

async function loadMetrics() {
  console.log('📈 正在从 Firebase 计算实时指标...');
  
  try {
    // 确保已经初始化了 db
    if (!window.db) return;

    const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
    const querySnapshot = await getDocs(window.ordersCollection);
    
    let totalRevenue = 0;
    let orderCount = 0;

    querySnapshot.forEach(doc => {
      const data = doc.data();
      totalRevenue += Number(data.total || 0);
      orderCount++;
    });

    const avgValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // --- 这里调用你刚才提到的更新 UI 的逻辑 ---
    const metricsCards = document.querySelectorAll('.metrics-section .card');
    
    if (metricsCards.length >= 4) {
      // 1. 平均订单价值 (Avg Order Value)
      metricsCards[0].querySelector('p').textContent = `RM ${avgValue.toFixed(2)}`;
      
      // 2. 转化率 (演示用逻辑)
      const conversionRate = orderCount > 0 ? (orderCount / 50 * 100).toFixed(1) : 0;
      metricsCards[1].querySelector('p').textContent = `${conversionRate}%`;

      // 3. 收入增长 (示例：显示总金额)
      metricsCards[3].querySelector('p').textContent = `RM ${totalRevenue.toFixed(2)}`;
      metricsCards[3].querySelector('h3').textContent = "Total Revenue"; 
    }

    console.log('✅ 指标卡片已更新');
  } catch (error) {
    console.error("❌ 统计加载失败:", error);
  }
}

function downloadReport() {
  const timeRange = document.getElementById('time-range').value;
  alert(`Downloading ${timeRange} report... (Feature coming soon)`);
}

// ========================================
// ACCOUNT MANAGEMENT
// ========================================
function initializeAccount() {
  if (!window.location.pathname.includes('admin-account.html')) return;
  
  // Account-specific initialization
  // Logout is handled globally, no need to add listener here
  console.log('Admin Account page initialized');
}

function changeEmail() {
  const currentEmail = document.getElementById('current-email').textContent;
  const newEmail = document.getElementById('new-email').value.trim();
  
  if (!newEmail) {
    alert('Please enter a new email address');
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    alert('Please enter a valid email address');
    return;
  }
  
  if (newEmail === currentEmail) {
    alert('New email must be different from current email');
    return;
  }
  
  const confirm = window.confirm(
    `Change email from:\n${currentEmail}\n\nTo:\n${newEmail}\n\nYou will need to verify your new email address. Continue?`
  );
  
  if (!confirm) return;
  
  document.getElementById('current-email').textContent = newEmail;
  document.getElementById('new-email').value = '';
  
  alert('✅ Email updated successfully! Please check your inbox for verification link.');
}

function changePassword() {
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    alert('Please fill in all password fields');
    return;
  }
  
  if (newPassword.length < 8) {
    alert('New password must be at least 8 characters long');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    alert('New passwords do not match');
    return;
  }
  
  if (currentPassword === newPassword) {
    alert('New password must be different from current password');
    return;
  }
  
  const confirm = window.confirm('Are you sure you want to change your password?');
  
  if (!confirm) return;
  
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  
  alert('✅ Password updated successfully!');
}

async function toggleWebsiteStatus() {
  const checkbox = document.getElementById('website-status');
  const isOpen = checkbox.checked;

  try {
    // 💡 将 updateDoc 改为从 firebase-firestore.js 导入 setDoc
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
    const siteRef = doc(window.db, "settings", "site_status");
    
    // 🚀 使用 setDoc + merge: true
    await setDoc(siteRef, {
      isOpen: isOpen,
      lastUpdated: new Date()
    }, { merge: true });

    // 更新 UI (保持你原有的逻辑)
    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = isOpen ? 'Open' : 'Closed';
    
    console.log("✅ 网站状态已成功同步到 Firebase");
    alert(isOpen ? '✅ Store is now OPEN!' : '🔒 Store is now CLOSED.');
  } catch (error) {
    console.error("❌ Failed to update status:", error);
    // 发生错误时，将开关拨回原位
    checkbox.checked = !isOpen;
    alert("Error updating status. Please check your permissions.");
  }
}

function deleteWebsite() {
  const confirmStep1 = window.confirm(
    '⚠️ DANGER ZONE ⚠️\n\n' +
    'You are about to DELETE the ENTIRE WEBSITE!\n\n' +
    'This will permanently delete:\n' +
    '• All products and inventory\n' +
    '• All customer data\n' +
    '• All order history\n' +
    '• All analytics data\n' +
    '• All website content\n\n' +
    'THIS CANNOT BE UNDONE!\n\n' +
    'Do you want to continue?'
  );
  
  if (!confirmStep1) return;
  
  const confirmStep2 = window.confirm(
    '🚨 FINAL WARNING 🚨\n\n' +
    'This is your LAST CHANCE to cancel!\n\n' +
    'Are you ABSOLUTELY SURE you want to delete everything?\n\n' +
    'Click OK to proceed with deletion.\n' +
    'Click Cancel to keep your website safe.'
  );
  
  if (!confirmStep2) {
    alert('✅ Deletion cancelled. Your website is safe.');
    return;
  }
  
  const typedConfirmation = prompt(
    'To confirm deletion, type exactly:\nDELETE EVERYTHING\n\n' +
    '(Type carefully - this is case sensitive)'
  );
  
  if (typedConfirmation !== 'DELETE EVERYTHING') {
    alert('❌ Confirmation text did not match. Deletion cancelled.');
    return;
  }
  
  alert(
    '💥 WEBSITE DELETION INITIATED\n\n' +
    'All data is being permanently deleted...\n\n' +
    'This process cannot be stopped or reversed.'
  );
  
  setTimeout(() => {
    alert('🗑️ Website deletion complete. You will be redirected.');
  }, 2000);
}

// ========================================
// INITIALIZE ALL ADMIN PAGES
// ========================================
document.addEventListener('DOMContentLoaded', function() {
  // Initialize logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    // Remove any existing listeners
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    
    newLogoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
  
  // Initialize page-specific functions
  initializeDashboard();
  initializeProducts();
  initializeOrders();
  initializeCustomers();
  initializeAnalytics();
  initializeAccount();

  // Load customers data when on customers page
    if (window.location.pathname.includes('admin-customers.html')) {
        loadCustomers();
    }

  console.log('Admin page loaded');
  console.log('✅ Admin Customers Sync System Loaded');
  console.log('💡 Available commands:');
  console.log('  - displayCustomerStats() - View customer statistics');
  console.log('  - loadCustomers() - Reload customer data');
  console.log('  - exportCustomers() - Export to CSV');
});


window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewOrderDetails = viewOrderDetails;
window.loadDashboardData = loadDashboardData;
window.initializeDashboard = initializeDashboard;
window.logout = logout;
window.getProductById = getProductById;
window.capitalizeFirst = capitalizeFirst;
window.formatDate = formatDate;
window.applyFilters = applyFilters;
window.initializeProducts = initializeProducts;
window.loadProducts = loadProducts;
window.renderProductsTable = renderProductsTable;
window.initializeOrders = initializeOrders;
window.loadOrders = loadOrders;
window.getAllProducts = getAllProducts;
window.applyOrderFilters = applyOrderFilters;
window.changeEmail = changeEmail;
window.changePassword = changePassword;
window.toggleWebsiteStatus = toggleWebsiteStatus;
window.deleteWebsite = deleteWebsite;
window.initializeAccount = initializeAccount;

