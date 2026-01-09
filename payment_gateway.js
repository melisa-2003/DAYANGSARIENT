// ========================================
// PAYMENT GATEWAY JAVASCRIPT
// Handles FPX and E-Wallet payment flows
// ========================================

function validatePaymentSession() {
    const orderData = JSON.parse(localStorage.getItem('lastOrder'));
    
    if (!orderData) {
        alert('No active order found. Please start checkout again.');
        window.location.replace('cart.html');
        return false;
    }
    
    if (orderData.paymentCompleted === true || orderData.status === 'completed') {
        alert('This order has already been paid. Redirecting...');
        window.location.replace('checkout_success.html');
        return false;
    }
    
    return true;
}

// Global variables
let selectedBank = null;
let selectedWallet = null;
let paymentTimer = null;
let timeRemaining = 300; // 5 minutes

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initializePaymentPage();
});

function initializePaymentPage() {
    if (!validatePaymentSession()) {
        return;
    }
    
    const orderData = JSON.parse(localStorage.getItem('lastOrder'));
    
    if (!orderData) {
        alert('No order data found. Redirecting to checkout...');
        window.location.href = 'checkout.html';
        return;
    }
    
    displayPaymentInfo(orderData);
    
    if (window.location.pathname.includes('payment_fpx.html')) {
        initializeFPXPage();
    } else if (window.location.pathname.includes('payment_ewallet.html')) {
        initializeEWalletPage();
    }
}

// ========================================
// PREVENT BACK BUTTON (Keep only this one)
// ========================================

window.addEventListener('load', function() {
    if (window.location.pathname.includes('payment_')) {
        // Push initial state to history
        window.history.pushState(null, null, window.location.href);
        
        // Listen for back button
        window.addEventListener('popstate', function() {
            const confirmLeave = confirm('Going back will cancel your payment. Are you sure?');
            if (confirmLeave) {
                localStorage.removeItem('lastOrder');
                window.location.replace('cart.html');
            } else {
                // Keep them on payment page
                window.history.pushState(null, null, window.location.href);
            }
        });
    }
});

// ========================================
// DISPLAY PAYMENT INFORMATION
// ========================================

function displayPaymentInfo(orderData) {
    const amountElements = document.querySelectorAll('#paymentAmount, .amount-value');
    amountElements.forEach(el => {
        if (el) el.textContent = `RM ${orderData.total.toFixed(2)}`;
    });
    
    const orderIdElement = document.getElementById('orderId');
    if (orderIdElement) {
        const orderId = orderData.isRetryingPayment 
            ? 'RETRY-' + orderData.time.split(',')[0].replace(/\//g, '')
            : 'ORD' + Date.now().toString().slice(-10);
        orderIdElement.textContent = orderId;
    }
    
    // Show a message if this is a retry payment
    if (orderData.isRetryingPayment) {
        const paymentDetailsBox = document.querySelector('.payment-details-box');
        if (paymentDetailsBox) {
            const retryNotice = document.createElement('div');
            retryNotice.style.cssText = `
                background: rgba(255, 193, 7, 0.15);
                border: 2px solid rgba(255, 193, 7, 0.5);
                border-radius: 10px;
                padding: 1rem;
                margin-top: 1rem;
                text-align: center;
            `;
            retryNotice.innerHTML = `
                <p style="margin: 0; color: #fff; font-weight: 600;">
                    Completing payment
                </p>
                <p style="margin: 0.5rem 0 0 0; color: rgba(255,255,255,0.8); font-size: 0.9rem;">
                    Order Date: ${orderData.time}
                </p>
            `;
            paymentDetailsBox.appendChild(retryNotice);
        }
    }
}

// ========================================
// FPX PAYMENT PAGE
// ========================================

function initializeFPXPage() {
    console.log('FPX Payment Page Initialized');
    
    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) {
        proceedBtn.disabled = true;
    }
}

function selectBank(bankName) {
    selectedBank = bankName;
    
    const bankOptions = document.querySelectorAll('.bank-option');
    bankOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    event.currentTarget.classList.add('selected');
    
    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) {
        proceedBtn.disabled = false;
    }
    
    console.log('Selected bank:', bankName);
}

function proceedToBank() {
    if (!selectedBank) {
        alert('Please select a bank to proceed.');
        return;
    }
    
    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) {
        proceedBtn.textContent = 'Redirecting...';
        proceedBtn.disabled = true;
    }
    
    setTimeout(() => {
        alert(`Redirecting to ${selectedBank} online banking...\n\nThis is a demo - click "Simulate Successful Payment" to complete.`);
        
        setTimeout(() => {
            simulatePaymentSuccess();
        }, 2000);
    }, 1000);
}

// ========================================
// E-WALLET PAYMENT PAGE
// ========================================

function initializeEWalletPage() {
    console.log('E-Wallet Payment Page Initialized');
    
    generateQRCode();
    startPaymentTimer();
    setupWalletSelection();
}

function setupWalletSelection() {
    const walletIcons = document.querySelectorAll('.wallet-icon');
    walletIcons.forEach(icon => {
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', function() {
            const walletName = this.getAttribute('title');
            selectWallet(walletName, this);
        });
    });
}

function selectWallet(walletName, iconElement) {
    selectedWallet = walletName;
    
    const walletIcons = document.querySelectorAll('.wallet-icon');
    walletIcons.forEach(icon => {
        icon.classList.remove('selected-wallet');
    });
    
    iconElement.classList.add('selected-wallet');
    
    updatePaymentInstruction(walletName);
    generateQRCode(walletName);
    
    console.log('Selected wallet:', walletName);
}

function updatePaymentInstruction(walletName) {
    const instruction = document.querySelector('.qr-instruction');
    if (instruction) {
        instruction.textContent = `Scan this QR code with ${walletName}`;
        instruction.style.color = '#2c3e50';
        instruction.style.fontWeight = '600';
    }
}

function generateQRCode(walletName = null) {
    const qrContainer = document.getElementById('qrCanvas');
    if (!qrContainer) return;
    
    qrContainer.innerHTML = '';
    
    if (!walletName) {
        qrContainer.innerHTML = `
            <div style="width: 200px; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border: 2px dashed #dee2e6; color: #495057;">
                <div style="font-size: 3.5rem; margin-bottom: 1rem; opacity: 0.6;">💳</div>
                <div style="font-size: 0.95rem; font-weight: 600; text-align: center; padding: 0 1rem; line-height: 1.4;">Please choose your preferred e-wallet</div>
            </div>
        `;
        return;
    }
    
    const qrImages = {
        "Touch 'n Go": "asset/qr/tng.jpg",
        "GrabPay": "asset/qr/grab.jpg",
        "DuitNow QR": "asset/qr/duitnow.jpg",
        "ShopeePay": "asset/qr/duitnow.jpg",
        "SarawakPay": "asset/qr/spay.jpg"
    };
    
    const img = document.createElement('img');
    img.style.width = '200px';
    img.style.height = '200px';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '8px';
    img.src = qrImages[walletName];
    img.alt = `${walletName} QR Code`;
    
    img.onerror = function() {
        qrContainer.innerHTML = `
            <div style="width: 200px; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8d7da; border-radius: 8px; border: 2px solid #f5c6cb; color: #721c24;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">⚠️</div>
                <div style="font-size: 0.9rem; font-weight: 600; text-align: center; padding: 0 1rem;">${walletName}</div>
                <div style="font-size: 0.75rem; margin-top: 0.3rem;">QR Code Not Found</div>
            </div>
        `;
    };
    
    qrContainer.appendChild(img);
}

function startPaymentTimer() {
    const timerDisplay = document.getElementById('timer');
    const timerBar = document.getElementById('timerBar');
    
    if (!timerDisplay || !timerBar) return;
    
    paymentTimer = setInterval(() => {
        timeRemaining--;
        
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const percentage = (timeRemaining / 300) * 100;
        timerBar.style.width = `${percentage}%`;
        
        if (timeRemaining <= 0) {
            clearInterval(paymentTimer);
            handlePaymentTimeout();
        }
        
        if (timeRemaining === 60) {
            alert('Only 1 minute remaining! Please complete your payment soon.');
        }
    }, 1000);
}

function handlePaymentTimeout() {
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.className = 'payment-status failed';
        statusDiv.innerHTML = `
            <div class="status-icon">⏰</div>
            <p>Payment session expired</p>
            <small>Please start a new payment session</small>
        `;
    }
    
    setTimeout(() => {
        if (confirm('Payment session expired. Would you like to try again?')) {
            window.location.href = 'checkout.html';
        } else {
            window.location.href = 'cart.html';
        }
    }, 2000);
}

// ========================================
// PAYMENT COMPLETION
// ========================================
async function simulatePaymentSuccess() {
    if (paymentTimer) clearInterval(paymentTimer);
    
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.className = 'payment-status success';
        statusDiv.innerHTML = `
            <div class="status-icon">✅</div>
            <p><strong>Payment Successful!</strong></p>
            <small>Updating order and redirecting...</small>
        `;
    }
    
    const orderData = JSON.parse(localStorage.getItem('lastOrder'));
    if (orderData) {
        const paymentTime = new Date().toLocaleString();
        const updatedStatus = 'processing'; // 💡 建议改为 processing，表示已付款待处理

        // 1. 更新本地数据
        orderData.status = updatedStatus;
        orderData.paymentCompleted = true;
        orderData.paymentTime = paymentTime;
        localStorage.setItem('lastOrder', JSON.stringify(orderData));
        
        // 2. 💡 关键：同步更新 Firebase 云端数据库
        if (orderData.id && window.db) {
            try {
                // 动态获取 Firebase 函数（因为是在模块外部）
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js");
                const orderRef = doc(window.db, "orders", orderData.id);
                await updateDoc(orderRef, {
                    status: updatedStatus,
                    paymentCompleted: true,
                    paymentTime: paymentTime
                });
                console.log("✅ Firebase order updated successfully");
            } catch (error) {
                console.error("❌ Firebase update failed:", error);
            }
        }
    }
    
    setTimeout(() => {
        window.location.replace('checkout_success.html');
    }, 2000);
}

function simulatePaymentFailure() {
    if (paymentTimer) {
        clearInterval(paymentTimer);
    }
    
    const statusDiv = document.getElementById('paymentStatus');
    if (statusDiv) {
        statusDiv.className = 'payment-status failed';
        statusDiv.innerHTML = `
            <div class="status-icon">❌</div>
            <p><strong>Payment Failed</strong></p>
            <small>Please try again or use a different payment method</small>
        `;
    }
    
    setTimeout(() => {
        if (confirm('Payment failed. Would you like to try again?')) {
            window.location.href = 'checkout.html';
        } else {
            window.location.href = 'cart.html';
        }
    }, 2000);
}

function completePayment() {
    const orderData = JSON.parse(localStorage.getItem('lastOrder'));
    if (!orderData) {
        alert('Order not found');
        return;
    }

    // ✅ Mark payment as completed and set status to PROCESSING
    orderData.paymentCompleted = true;
    orderData.status = ORDER_STATUS.PROCESSING;
    orderData.paymentCompletedAt = new Date().toLocaleString();

    // Update in order history
    const user = getCurrentUser();
    const orderKey = "orderHistory_" + user.email;
    let history = JSON.parse(localStorage.getItem(orderKey)) || [];
    
    // Find and update the order
    const orderIndex = history.findIndex(o => 
        o.time === orderData.time && o.total === orderData.total
    );
    
    if (orderIndex !== -1) {
        history[orderIndex] = orderData;
        localStorage.setItem(orderKey, JSON.stringify(history));
    }
    
    localStorage.setItem("lastOrder", JSON.stringify(orderData));
    
    // Redirect to success page
    window.location.href = "checkout_success.html";
}

function cancelPayment() {
    const confirmCancel = confirm('Are you sure you want to cancel this payment?');
    
    if (confirmCancel) {
        if (paymentTimer) {
            clearInterval(paymentTimer);
        }
        
        localStorage.removeItem('lastOrder');
        
        alert('Payment cancelled. You can retry from your cart.');
        window.location.replace('cart.html');
    }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function getCurrentUser() {
    const userDataSession = sessionStorage.getItem('userData');
    const userDataLocal = localStorage.getItem('userData');
    
    if (userDataSession) {
        return JSON.parse(userDataSession);
    } else if (userDataLocal) {
        return JSON.parse(userDataLocal);
    }
    return null;
}

window.simulatePaymentSuccess = simulatePaymentSuccess;
window.simulatePaymentFailure = simulatePaymentFailure;
window.cancelPayment = cancelPayment;
window.selectBank = selectBank;
window.proceedToBank = proceedToBank;