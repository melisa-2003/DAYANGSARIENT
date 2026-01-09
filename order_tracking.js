// ========================================
// ORDER TRACKING PAGE JAVASCRIPT - FIXED
// ========================================

const ORDER_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered'
};

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('order_tracking.html')) {
        // 增加延时确保 Firebase window 对象已初始化
        const checkFirebase = setInterval(() => {
            if (window.db && window.ordersCollection) {
                clearInterval(checkFirebase);
                initializeOrderTracking();
            }
        }, 500);
    }
});

async function initializeOrderTracking() {
    const user = getCurrentUser();
    if (!user) {
        alert("Please sign in to track your orders.");
        window.location.href = 'signin.html';
        return;
    }

    const loader = document.getElementById('pageLoader');
    if (loader) loader.style.display = 'flex';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const orderIdFromUrl = urlParams.get('orderId'); // 获取 URL 传来的 ID

        let orderData = null;

        // --- 逻辑判断：是查指定订单还是最新订单 ---
        if (orderIdFromUrl) {
            console.log("正在查询指定订单 ID:", orderIdFromUrl);
            // 补全 getDoc 逻辑：直接通过 ID 从 Firebase 抓取
            const docRef = window.doc(window.db, "orders", orderIdFromUrl);
            const docSnap = await window.getDoc(docRef);

            if (docSnap.exists()) {
                orderData = { id: docSnap.id, ...docSnap.data() };
            } else {
                console.warn("Firebase 中找不到该订单 ID");
            }
        }

        // 如果没有 orderId 或者按 ID 没查到，则查询该用户的最新订单
        if (!orderData) {
            console.log("正在查询最新一笔订单...");
            const q = window.query(
                window.ordersCollection,
                window.where("userEmail", "==", user.email),
                window.orderBy("orderDate", "desc"),
                window.limit(1)
            );

            const querySnapshot = await window.getDocs(q);

            if (!querySnapshot.empty) {
                const orderDoc = querySnapshot.docs[0];
                orderData = { id: orderDoc.id, ...orderDoc.data() };
            }
        }

        // --- 渲染页面 ---
        if (orderData) {
            console.log("成功加载订单数据:", orderData);
            displayOrderTracking(orderData);
            displayCarrierInfo(orderData);
            
            // 如果你有生成二维码的逻辑，确保在这里触发
            if (typeof generateOrderQRCode === 'function') {
                generateOrderQRCode(orderData.id);
            }
        } else {
            alert("No orders found in your account.");
            window.location.href = 'myaccount.html';
            return;
        }
        
        if (loader) loader.style.display = 'none';

    } catch (error) {
        console.error("Error loading order:", error);
        if (loader) loader.style.display = 'none';
        alert("Failed to load order information. Please try again.");
    }
}

// ========================================
// DISPLAY LOGIC (统一版本，删除了重复定义)
// ========================================

function displayOrderTracking(order) {
    // 订单号：如果有 Firebase ID 用 ID，否则用随机数
    const displayId = order.id || order.orderNumber || 'N/A';
    document.getElementById('orderNumber').textContent = displayId.toString().substring(0, 8).toUpperCase();
    
    // 订单日期
    const dateValue = order.orderDate || order.time || new Date();
    document.getElementById('orderDate').textContent = new Date(dateValue).toLocaleString();
    
    // 更新状态文字和进度条
    const currentStatus = order.status || ORDER_STATUS.PROCESSING;
    updateTimeline(currentStatus);

    const statusTexts = {
        [ORDER_STATUS.PENDING]: 'Payment pending',
        [ORDER_STATUS.PROCESSING]: 'Your order is being prepared',
        [ORDER_STATUS.SHIPPED]: 'Your order is on the way',
        [ORDER_STATUS.DELIVERED]: 'Your order has been delivered'
    };
    const statusTextEl = document.getElementById('orderStatusText');
    if (statusTextEl) statusTextEl.textContent = statusTexts[currentStatus] || 'Processing';

    // 商品列表
    displayOrderItems(order);

    // 地址
    document.getElementById('shippingAddress').textContent = order.address || "N/A";

    // 渲染 QR Code
    if (typeof QRCode !== 'undefined') {
        const qrContainer = document.getElementById('orderQRCode');
        if (qrContainer) {
            qrContainer.innerHTML = "";
            new QRCode(qrContainer, { text: displayId, width: 80, height: 80 });
        }
    }
}

function updateTimeline(currentStatus) {
    const steps = ['ordered', 'ready', 'transit', 'delivered'];
    const statusMap = {
        [ORDER_STATUS.PROCESSING]: 0,
        'ready': 1,
        [ORDER_STATUS.SHIPPED]: 2,
        [ORDER_STATUS.DELIVERED]: 3
    };

    const currentIndex = statusMap[currentStatus] ?? 0;
    steps.forEach((step, index) => {
        const el = document.getElementById(`step-${step}`);
        if (!el) return;
        
        el.classList.remove('completed', 'active');
        if (index < currentIndex) el.classList.add('completed');
        else if (index === currentIndex) el.classList.add('active');
    });
}

function displayOrderItems(order) {
    const container = document.getElementById('orderItemsList');
    if (!container) return;

    if (!order.cart || order.cart.length === 0) {
        container.innerHTML = '<p style="color: #999;">No items found</p>';
        return;
    }

    container.innerHTML = order.cart.map(item => `
        <div class="order-item-row">
            <div class="order-item-image">
                <img src="${item.image || 'asset/cookies.png'}" alt="${item.name}" onerror="this.src='asset/cookies.png'">
            </div>
            <div class="order-item-details">
                <h4>${item.name}</h4>
                <p>RM ${parseFloat(item.price).toFixed(2)} x ${item.quantity}</p>
            </div>
            <div class="order-item-price">
                RM ${(parseFloat(item.price) * item.quantity).toFixed(2)}
            </div>
        </div>
    `).join('');
}

function displayCarrierInfo(order) {
    // 1. 物流单号：如果没有真实单号，显示 "Awaiting fulfillment" 而不是随机生成
    const trackEl = document.getElementById('trackingNumber');
    if (trackEl) {
        trackEl.textContent = order.trackingNumber || 'Awaiting fulfillment';
    }
    
    // 2. 发货地点：通常是你的店面地址
    const locEl = document.getElementById('carrierLocation');
    if (locEl) {
        locEl.textContent = 'Origin: DayangSari HQ, Kuching, Sarawak';
    }
    
    // 3. 💡 修复奇怪的地点：显示用户真实的配送地址
    const destEl = document.getElementById('destinationLocation');
    if (destEl) {
        // 直接显示订单里的完整地址，或者截取城市名
        destEl.textContent = 'Destination: ' + (order.address || 'Standard Shipping');
    }

    // 4. 💡 修复 Lorem Ipsum (如果你的 HTML 里有这个 ID)
    const statusDesc = document.getElementById('orderStatusDescription');
    if (statusDesc) {
        const statusDetails = {
            [ORDER_STATUS.PENDING]: 'Waiting for payment confirmation.',
            [ORDER_STATUS.PROCESSING]: 'We are currently baking and packing your cookies!',
            [ORDER_STATUS.SHIPPED]: `Your package is with our courier and heading to ${order.address}.`,
            [ORDER_STATUS.DELIVERED]: 'Order successfully delivered. Enjoy your cookies!'
        };
        statusDesc.textContent = statusDetails[order.status] || 'Processing your request...';
    }
}

// ========================================
// HELPER & WINDOW FUNCTIONS
// ========================================

function getCurrentUser() {
    const userData = localStorage.getItem('currentUser') || localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

// 暴露函数给 HTML 的 onclick
window.contactSupport = function() {
    alert("Support contact initiated. Our team will contact you soon.");
};

window.viewShipmentDetails = function() {
    const trackingNo = document.getElementById('trackingNumber').textContent;
    alert("Tracking Number: #" + trackingNo + "\nCarrier: FedEx\nStatus: In Transit");
};

window.viewOrderDetails = function() {
    window.location.href = 'myaccount.html?section=orders';
};