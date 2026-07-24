// Application Logic for Shoe Spa Manager (Version 2 - Isolated DB & Custom Branding)

// 1. STATE & STORAGE MANAGEMENT
const state = {
  currentUser: null,
  orders: [],
  services: [],
  users: [],
  storeInfo: null,
  activeView: 'login',
  currentEditingOrder: null,
  currentEditingService: null,
  currentEditingEmployee: null,
  tempSelectedFiles: [], // temporary selected files for upload [{id, file, previewUrl}]
  tempExistingImages: [] // existing images kept when editing [{url}]
};

// Initialize app data from Firebase Cloud (V2 collections) or LocalStorage fallback (pb_v2_* keys)
async function initData() {
  if (window.db) {
    try {
      console.log("Syncing V2 database with Firebase Firestore Cloud...");
      
      // 0. Load Store Info Branding
      try {
        const storeSnap = await window.db.collection('v2_store_info').doc('main').get();
        if (storeSnap.exists) {
          state.storeInfo = storeSnap.data();
        } else {
          state.storeInfo = window.DEFAULT_STORE_INFO || {};
          await window.db.collection('v2_store_info').doc('main').set(state.storeInfo);
        }
      } catch (e) {
        console.error("Error loading store info from Firebase V2:", e);
        state.storeInfo = window.DEFAULT_STORE_INFO || {};
      }
      saveState('pb_v2_store_info', state.storeInfo);

      // 1. Load users
      const usersSnap = await window.db.collection('v2_users').get();
      if (usersSnap.empty) {
        for (let u of window.DEFAULT_USERS || []) {
          await window.db.collection('v2_users').doc(u.id).set(u);
        }
        state.users = window.DEFAULT_USERS || [];
      } else {
        state.users = usersSnap.docs.map(doc => doc.data());
      }
      saveState('pb_v2_users', state.users);

      // 2. Load services
      const servicesSnap = await window.db.collection('v2_services').get();
      if (servicesSnap.empty) {
        for (let s of window.DEFAULT_SERVICES || []) {
          await window.db.collection('v2_services').doc(s.id).set(s);
        }
        state.services = window.DEFAULT_SERVICES || [];
      } else {
        state.services = servicesSnap.docs.map(doc => doc.data());
      }
      saveState('pb_v2_services', state.services);

      // 3. Load orders
      const ordersSnap = await window.db.collection('v2_orders').get();
      state.orders = ordersSnap.docs.map(doc => doc.data());
      saveState('pb_v2_orders', state.orders);
      
    } catch (error) {
      console.error("Firebase V2 sync failed, falling back to LocalStorage:", error);
      loadFromLocalStorage();
    }
  } else {
    loadFromLocalStorage();
  }

  // Update dynamic Store Branding UI
  updateStoreBrandingUI();

  // Check for public tracking query parameter ?order=ID
  const urlParams = new URLSearchParams(window.location.search);
  const orderIdParam = urlParams.get('order');
  if (orderIdParam) {
    // Switch view to public tracking and load details
    switchView('public-tracking');
    loadPublicTracking(orderIdParam);
    return;
  }

  // Check login state
  const savedUser = localStorage.getItem('pb_v2_current_user');
  if (savedUser) {
    state.currentUser = JSON.parse(savedUser);
    if (state.currentUser.role === 'admin') {
      switchView('dashboard');
    } else {
      switchView('orders');
    }
    updateProfileUI();
  } else {
    switchView('login');
  }
}

// Fallback: local storage loader (isolated V2 keys)
function loadFromLocalStorage() {
  if (!localStorage.getItem('pb_v2_store_info')) {
    localStorage.setItem('pb_v2_store_info', JSON.stringify(window.DEFAULT_STORE_INFO || {}));
  }
  if (!localStorage.getItem('pb_v2_users')) {
    localStorage.setItem('pb_v2_users', JSON.stringify(window.DEFAULT_USERS || []));
  }
  if (!localStorage.getItem('pb_v2_services')) {
    localStorage.setItem('pb_v2_services', JSON.stringify(window.DEFAULT_SERVICES || []));
  }
  if (!localStorage.getItem('pb_v2_orders')) {
    localStorage.setItem('pb_v2_orders', JSON.stringify(window.INITIAL_ORDERS || []));
  }

  state.storeInfo = JSON.parse(localStorage.getItem('pb_v2_store_info'));
  state.users = JSON.parse(localStorage.getItem('pb_v2_users'));
  state.services = JSON.parse(localStorage.getItem('pb_v2_services'));
  state.orders = JSON.parse(localStorage.getItem('pb_v2_orders'));
}

// Sync helper that updates LocalStorage instantly and uploads to Firebase asynchronously
// Sync helper that updates LocalStorage instantly
function saveState(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving state for key "${key}" to localStorage:`, e);
  }
}

// 2. SPA ROUTER & NAVIGATION
function switchView(viewId) {
  // Access control
  if (viewId !== 'login' && viewId !== 'public-tracking' && !state.currentUser) {
    viewId = 'login';
  }
  
  if (state.currentUser && state.currentUser.role !== 'admin' && ['dashboard', 'services', 'employees', 'store-settings'].includes(viewId)) {
    // Staff cannot access admin views
    viewId = 'orders';
  }

  state.activeView = viewId;
  
  // Update UI active sections
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  const targetSec = document.getElementById(`view-${viewId}`);
  if (targetSec) targetSec.classList.add('active');

  // Update Sidebar menu active class
  document.querySelectorAll('.sidebar-menu li').forEach(li => {
    li.classList.remove('active');
    if (li.getAttribute('data-view') === viewId) {
      li.classList.add('active');
    }
  });

  // Handle specific view rendering
  if (viewId === 'dashboard') {
    renderDashboard();
  } else if (viewId === 'orders') {
    renderOrders();
  } else if (viewId === 'customers') {
    renderCustomers();
  } else if (viewId === 'services') {
    renderServicesList();
  } else if (viewId === 'employees') {
    renderEmployeesList();
  } else if (viewId === 'store-settings') {
    populateStoreSettingsForm();
  }
}

// Dynamic Store Branding UI Update
function updateStoreBrandingUI() {
  const info = state.storeInfo || window.DEFAULT_STORE_INFO || {};
  const storeName = info.name || 'SPA GIÀY';
  const storeSubtitle = info.subtitle || 'SHOE SPA & REPAIR';
  const storeHotline = info.hotline || '0906 22 7512';
  const storeAddress = info.address || '';
  const storeLogo = info.logoUrl || '';
  const receiptNote = info.receiptNote || '';

  document.title = `${storeName} - Quản lý cửa hàng`;

  // Sidebar Header
  const sidebarName = document.getElementById('sidebar-brand-name');
  if (sidebarName) sidebarName.textContent = storeName;
  const sidebarSub = document.getElementById('sidebar-brand-subtitle');
  if (sidebarSub) sidebarSub.textContent = storeSubtitle;
  const sidebarLogoContainer = document.getElementById('sidebar-brand-logo-container');
  const sidebarLogoImg = document.getElementById('sidebar-brand-logo-img');
  if (sidebarLogoContainer && sidebarLogoImg) {
    if (storeLogo) {
      sidebarLogoImg.src = storeLogo;
      sidebarLogoContainer.style.display = 'block';
    } else {
      sidebarLogoContainer.style.display = 'none';
    }
  }

  // Login Card
  const loginName = document.getElementById('login-brand-name');
  if (loginName) loginName.textContent = storeName;
  const loginSub = document.getElementById('login-brand-subtitle');
  if (loginSub) loginSub.textContent = `Hệ thống Quản lý cửa hàng ${storeName}`;
  const loginLogoContainer = document.getElementById('login-brand-logo-container');
  const loginLogoImg = document.getElementById('login-brand-logo-img');
  if (loginLogoContainer && loginLogoImg) {
    if (storeLogo) {
      loginLogoImg.src = storeLogo;
      loginLogoContainer.style.display = 'block';
    } else {
      loginLogoContainer.style.display = 'none';
    }
  }

  // Thermal Receipt Header & Footer
  const printName = document.getElementById('print-brand-name');
  if (printName) printName.textContent = storeName;
  const printSub = document.getElementById('print-brand-subtitle');
  if (printSub) printSub.textContent = storeSubtitle;
  const printAddress = document.getElementById('print-brand-address');
  if (printAddress) printAddress.textContent = storeAddress;
  const printHotline = document.getElementById('print-brand-hotline');
  if (printHotline) printHotline.textContent = storeHotline;
  const printLogoContainer = document.getElementById('print-brand-logo-container');
  const printLogoImg = document.getElementById('print-brand-logo-img');
  if (printLogoContainer && printLogoImg) {
    if (storeLogo) {
      printLogoImg.src = storeLogo;
      printLogoContainer.style.display = 'block';
    } else {
      printLogoContainer.style.display = 'none';
    }
  }
  const printNote = document.getElementById('print-receipt-note');
  if (printNote) {
    if (receiptNote) {
      printNote.innerHTML = receiptNote.replace(/\n/g, '<br>');
    } else {
      printNote.innerHTML = `<p>Cảm ơn quý khách đã tin tưởng dịch vụ của chúng tôi!</p><p>Quý khách vui lòng mang hóa đơn này khi nhận lại giày.</p>`;
    }
  }

  // Public Tracking Page Header & Contacts
  const trackName = document.getElementById('track-brand-name');
  if (trackName) trackName.textContent = storeName;
  const trackSub = document.getElementById('track-brand-subtitle');
  if (trackSub) trackSub.textContent = storeSubtitle;
  const trackLogoContainer = document.getElementById('track-brand-logo-container');
  const trackLogoImg = document.getElementById('track-brand-logo-img');
  if (trackLogoContainer && trackLogoImg) {
    if (storeLogo) {
      trackLogoImg.src = storeLogo;
      trackLogoContainer.style.display = 'block';
    } else {
      trackLogoContainer.style.display = 'none';
    }
  }

  const trackContactTitle = document.getElementById('track-brand-contact-title');
  if (trackContactTitle) trackContactTitle.textContent = `Cần hỗ trợ? Liên hệ ${storeName}:`;

  const cleanHotline = storeHotline.replace(/\s+/g, '');
  const trackHotlineBtn = document.getElementById('track-brand-hotline-btn');
  if (trackHotlineBtn) trackHotlineBtn.href = `tel:${cleanHotline}`;
  const trackHotlineText = document.getElementById('track-brand-hotline-text');
  if (trackHotlineText) trackHotlineText.textContent = `Hotline: ${storeHotline}`;

  const trackZaloBtn = document.getElementById('track-brand-zalo-btn');
  if (trackZaloBtn) trackZaloBtn.href = `https://zalo.me/${cleanHotline}`;

  const trackAddress = document.getElementById('track-brand-address');
  if (trackAddress) trackAddress.textContent = `Địa chỉ: ${storeAddress}`;
}

// Populate Store Settings Form
function populateStoreSettingsForm() {
  const info = state.storeInfo || window.DEFAULT_STORE_INFO || {};
  const nameInput = document.getElementById('store-name-input');
  if (nameInput) nameInput.value = info.name || '';
  const subInput = document.getElementById('store-subtitle-input');
  if (subInput) subInput.value = info.subtitle || '';
  const hotInput = document.getElementById('store-hotline-input');
  if (hotInput) hotInput.value = info.hotline || '';
  const addrInput = document.getElementById('store-address-input');
  if (addrInput) addrInput.value = info.address || '';
  const logoInput = document.getElementById('store-logo-url');
  if (logoInput) logoInput.value = info.logoUrl || '';
  const noteInput = document.getElementById('store-receipt-note-input');
  if (noteInput) noteInput.value = info.receiptNote || '';

  updateStoreLogoPreview(info.logoUrl || '');
}

function updateStoreLogoPreviewFromInput() {
  const url = document.getElementById('store-logo-url').value.trim();
  updateStoreLogoPreview(url);
}

function updateStoreLogoPreview(url) {
  const preview = document.getElementById('store-logo-preview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: contain;">`;
  } else {
    preview.innerHTML = `<span style="font-size: 0.75rem; color: #888; text-align: center; padding: 4px;">Chưa có logo</span>`;
  }
}

async function handleStoreLogoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const compressed = await compressImage(file, 400, 400, 0.85);
    document.getElementById('store-logo-url').value = compressed;
    updateStoreLogoPreview(compressed);
  } catch (err) {
    console.error("Lỗi nén logo:", err);
  }
}

async function handleStoreSettingsSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('store-name-input').value.trim();
  const subtitle = document.getElementById('store-subtitle-input').value.trim();
  const hotline = document.getElementById('store-hotline-input').value.trim();
  const address = document.getElementById('store-address-input').value.trim();
  const logoUrl = document.getElementById('store-logo-url').value.trim();
  const receiptNote = document.getElementById('store-receipt-note-input').value.trim();

  state.storeInfo = {
    name,
    subtitle,
    hotline,
    address,
    logoUrl,
    receiptNote
  };

  saveState('pb_v2_store_info', state.storeInfo);

  if (window.db) {
    try {
      await window.db.collection('v2_store_info').doc('main').set(state.storeInfo);
      console.log("Synced store info to Firebase V2.");
    } catch (err) {
      console.error("Error syncing store info to Firebase V2:", err);
    }
  }

  updateStoreBrandingUI();

  const msg = document.getElementById('store-settings-msg');
  if (msg) {
    msg.style.display = 'inline';
    setTimeout(() => { msg.style.display = 'none'; }, 3500);
  }

  alert('Cập nhật thông tin cửa hàng thành công!');
}

// Update profile in sidebar
function updateProfileUI() {
  const profileContainer = document.getElementById('sidebar-profile');
  if (state.currentUser) {
    profileContainer.style.display = 'flex';
    document.getElementById('profile-name').textContent = state.currentUser.name;
    document.getElementById('profile-role').textContent = state.currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
    document.getElementById('profile-initials').textContent = state.currentUser.name.split(' ').pop().substring(0, 2).toUpperCase();
    
    // Hide/Show Admin items in sidebar menu
    const adminItems = document.querySelectorAll('.admin-only');
    adminItems.forEach(item => {
      item.style.display = state.currentUser.role === 'admin' ? 'block' : 'none';
    });
  } else {
    profileContainer.style.display = 'none';
  }
}

// 3. AUTHENTICATION FLOW
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorMsg = document.getElementById('login-error-msg');

  const user = state.users.find(u => u.email === email && u.password === password);
  if (user) {
    state.currentUser = user;
    localStorage.setItem('pb_v2_current_user', JSON.stringify(user));
    errorMsg.style.display = 'none';
    
    // Reset login fields
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    updateProfileUI();
    
    if (user.role === 'admin') {
      switchView('dashboard');
    } else {
      switchView('orders');
    }
  } else {
    errorMsg.style.display = 'block';
    errorMsg.textContent = 'Email hoặc mật khẩu không đúng.';
  }
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('pb_v2_current_user');
  updateProfileUI();
  switchView('login');
}

// Helper: Format currency
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Helper: Format DateTime
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// Helper: Date Matching Logic
function isDateMatch(receivedDateStr, filterDate, filterMonth, filterYear) {
  if (!receivedDateStr) return false;
  const dateObj = new Date(receivedDateStr);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 1-12
  
  // If specific date is selected (YYYY-MM-DD)
  if (filterDate) {
    const fDate = new Date(filterDate);
    if (
      dateObj.getDate() !== fDate.getDate() ||
      dateObj.getMonth() !== fDate.getMonth() ||
      dateObj.getFullYear() !== fDate.getFullYear()
    ) {
      return false;
    }
  }

  // If specific month is selected (1-12)
  if (filterMonth && filterMonth !== 'all') {
    if (month !== parseInt(filterMonth)) return false;
  }

  // If specific year is selected
  if (filterYear && filterYear !== 'all') {
    if (year !== parseInt(filterYear)) return false;
  }

  return true;
}

// 4. ORDER MANAGEMENT
function renderOrders() {
  const searchTerm = document.getElementById('search-order').value.toLowerCase();
  const statusFilter = document.getElementById('filter-status').value;
  const filterDate = document.getElementById('filter-date').value;
  const filterMonth = document.getElementById('filter-month').value;
  const filterYear = document.getElementById('filter-year').value;
  
  const tbody = document.getElementById('orders-table-body');
  tbody.innerHTML = '';

  let filteredOrders = state.orders;

  // Filter by search
  if (searchTerm) {
    filteredOrders = filteredOrders.filter(o => 
      o.customerName.toLowerCase().includes(searchTerm) || 
      o.customerPhone.includes(searchTerm) ||
      o.id.toLowerCase().includes(searchTerm) ||
      (o.shoeInfo || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by status
  if (statusFilter !== 'all') {
    filteredOrders = filteredOrders.filter(o => o.status === statusFilter);
  }

  // Filter by day, month, year
  filteredOrders = filteredOrders.filter(o => isDateMatch(o.receivedDate, filterDate, filterMonth, filterYear));

  // Sort: newest first
  filteredOrders.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate));

  if (filteredOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 30px; color: var(--text-light);">Không tìm thấy đơn hàng nào</td></tr>`;
    return;
  }

  filteredOrders.forEach(o => {
    const tr = document.createElement('tr');
    
    // Status badge class
    let statusText = 'Chờ xử lý';
    let badgeClass = 'badge-pending';
    switch (o.status) {
      case 'pending': statusText = 'Chờ xử lý'; badgeClass = 'badge-pending'; break;
      case 'processing': statusText = 'Đang tiến hành'; badgeClass = 'badge-processing'; break;
      case 'completed': statusText = 'Đã hoàn thành'; badgeClass = 'badge-completed'; break;
      case 'paid': statusText = 'Đã thanh toán'; badgeClass = 'badge-paid'; break;
      case 'delivered': statusText = 'Đã giao khách'; badgeClass = 'badge-delivered'; break;
      case 'cancelled': statusText = 'Đã hủy'; badgeClass = 'badge-cancelled'; break;
    }

    const servicesText = o.services.map(s => `${s.name}${s.quantity > 1 ? ` (x${s.quantity})` : ''}`).join(', ');

    const firstImageHtml = o.images && o.images.length > 0 
      ? `<img src="${o.images[0]}" class="table-shoe-thumb" onclick="openLightbox('${o.images[0]}'); event.stopPropagation();" title="Xem ảnh lớn">` 
      : `<div class="table-shoe-thumb-placeholder" title="Chưa có ảnh"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/></svg></div>`;

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-brand-brown-dark);">${o.id}</td>
      <td>
        <div>
          <div style="font-weight: 600;">${o.customerName}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">${o.customerPhone}</div>
        </div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${firstImageHtml}
          <div style="overflow: hidden;">
            <div style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 150px;">${o.shoeInfo || '-'}</div>
            <div style="font-size: 0.8rem; color: var(--text-light); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 150px;">${servicesText}</div>
          </div>
        </div>
      </td>
      <td style="font-weight: 700; color: var(--color-brand-gold);">${formatVND(o.totalPrice)}</td>
      <td style="font-size: 0.85rem; color: var(--text-secondary);">${formatDateTime(o.receivedDate)}</td>
      <td><span class="badge ${badgeClass}">${statusText}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit" onclick="viewOrderDetail('${o.id}')" title="Xem chi tiết & In hóa đơn">
            <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </button>
          <button class="action-btn edit" onclick="copyTrackingLink('${o.id}')" title="Sao chép link tra cứu">
            <svg viewBox="0 0 24 24" style="color: var(--color-brand-gold);"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
          </button>
          <button class="action-btn edit" onclick="openOrderModal('${o.id}')" title="Chỉnh sửa đơn hàng">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          ${['pending', 'processing', 'completed'].includes(o.status) ? `
            <button class="action-btn edit" onclick="quickPayOrderFromTable('${o.id}')" title="Thanh toán nhanh" style="color: var(--status-paid-text);">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.68v-1.92c-1.94-.28-3.57-1.49-3.73-3.48h2.09c.12.96.99 1.54 1.64 1.54.91 0 1.62-.51 1.62-1.39 0-1-.61-1.36-2.09-1.84-1.98-.64-3.58-1.47-3.58-3.69 0-1.82 1.39-3.13 3.32-3.44V4h2.68v1.9c1.62.24 3.01 1.34 3.26 3.19h-2.06c-.22-.84-.81-1.33-1.55-1.33-.86 0-1.42.49-1.42 1.15 0 .84.58 1.19 1.99 1.69 2.11.75 3.68 1.56 3.68 3.82 0 1.91-1.41 3.23-3.67 3.51z" fill="currentColor"/></svg>
            </button>
          ` : ''}
          ${state.currentUser.role === 'admin' ? `
            <button class="action-btn delete" onclick="deleteOrder('${o.id}')" title="Xóa đơn hàng">
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Load services into form checklist
function populateServiceSelector(selectedServices = []) {
  const container = document.getElementById('form-services-selector');
  container.innerHTML = '';

  state.services.forEach(s => {
    const existingSelect = selectedServices.find(selected => selected.id === s.id);
    const isChecked = !!existingSelect;
    const quantity = existingSelect ? (existingSelect.quantity || 1) : 1;
    const price = existingSelect ? (existingSelect.price || s.defaultPrice) : s.defaultPrice;

    const div = document.createElement('div');
    div.className = `service-select-item ${isChecked ? 'selected' : ''}`;
    div.setAttribute('data-id', s.id);
    div.setAttribute('data-name', s.name);
    
    div.innerHTML = `
      <div class="service-select-info">
        <span class="service-select-name">${s.name}</span>
        <span class="service-select-cat">${s.category} (${s.priceRange})</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="service-qty-control" onclick="event.stopPropagation()">
          <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">Đôi:</span>
          <input type="number" class="service-qty-input" value="${quantity}" min="1">
        </div>
        
        <div style="display: flex; align-items: center;">
          <span class="service-select-price-static">${formatVND(price)}</span>
          
          <div class="service-price-control" onclick="event.stopPropagation()">
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">Giá:</span>
            <input type="number" class="service-price-input" value="${price}" min="0">
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--color-brand-brown);">đ</span>
          </div>
        </div>
      </div>
    `;

    div.addEventListener('click', () => {
      div.classList.toggle('selected');
      calculateOrderFormTotal();
    });

    const qtyInput = div.querySelector('.service-qty-input');
    qtyInput.addEventListener('change', calculateOrderFormTotal);
    qtyInput.addEventListener('input', calculateOrderFormTotal);
    qtyInput.addEventListener('click', (e) => e.stopPropagation());
    qtyInput.addEventListener('keyup', (e) => e.stopPropagation());

    const priceInput = div.querySelector('.service-price-input');
    priceInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) || 0;
      div.querySelector('.service-select-price-static').textContent = formatVND(val);
      calculateOrderFormTotal();
    });
    priceInput.addEventListener('change', calculateOrderFormTotal);
    priceInput.addEventListener('click', (e) => e.stopPropagation());
    priceInput.addEventListener('keyup', (e) => e.stopPropagation());

    container.appendChild(div);
  });
}

function calculateOrderFormTotal() {
  let total = 0;
  document.querySelectorAll('#form-services-selector .service-select-item.selected').forEach(item => {
    const priceInput = item.querySelector('.service-price-input');
    const price = parseInt(priceInput.value) || 0;
    const qtyInput = item.querySelector('.service-qty-input');
    const qty = parseInt(qtyInput.value) || 1;
    total += price * qty;
  });
  document.getElementById('order-total-price').value = total;
}

function openOrderModal(orderId = null) {
  const modal = document.getElementById('order-modal');
  const title = document.getElementById('order-modal-title');
  const form = document.getElementById('order-form');
  
  form.reset();
  state.currentEditingOrder = null;
  
  // Reset temporary image arrays
  state.tempSelectedFiles = [];
  state.tempExistingImages = [];
  const progressContainer = document.getElementById('upload-progress-container');
  if (progressContainer) progressContainer.style.display = 'none';

  if (orderId) {
    // Edit Order
    state.currentEditingOrder = state.orders.find(o => o.id === orderId);
    title.textContent = `Chỉnh Sửa Đơn Hàng ${orderId}`;
    
    // Fill form
    document.getElementById('order-cust-name').value = state.currentEditingOrder.customerName;
    document.getElementById('order-cust-phone').value = state.currentEditingOrder.customerPhone;
    document.getElementById('order-shoe-info').value = state.currentEditingOrder.shoeInfo;
    document.getElementById('order-notes').value = state.currentEditingOrder.notes;
    document.getElementById('order-status').value = state.currentEditingOrder.status;
    document.getElementById('order-total-price').value = state.currentEditingOrder.totalPrice;
    
    // Load existing images
    state.tempExistingImages = [...(state.currentEditingOrder.images || [])];
    
    // Status selection visibility
    document.getElementById('status-form-group').style.display = 'block';
    
    // Populate services selector and preselect
    populateServiceSelector(state.currentEditingOrder.services);
  } else {
    // New Order
    title.textContent = 'Thêm Đơn Hàng Mới';
    document.getElementById('status-form-group').style.display = 'block'; // Show status dropdown
    document.getElementById('order-status').value = 'pending'; // Default status
    populateServiceSelector([]);
  }

  renderOrderFormImagesPreview();
  modal.classList.add('active');
}

function closeOrderModal() {
  // Revoke preview object URLs to free memory
  state.tempSelectedFiles.forEach(item => {
    URL.revokeObjectURL(item.previewUrl);
  });
  state.tempSelectedFiles = [];
  state.tempExistingImages = [];
  document.getElementById('order-modal').classList.remove('active');
}

async function handleOrderSubmit(e) {
  e.preventDefault();
  
  const custName = document.getElementById('order-cust-name').value.trim();
  const custPhone = document.getElementById('order-cust-phone').value.trim();
  const shoeInfo = document.getElementById('order-shoe-info').value.trim();
  const notes = document.getElementById('order-notes').value.trim();
  const totalPrice = parseInt(document.getElementById('order-total-price').value) || 0;
  
  // Selected services
  const selectedServices = [];
  document.querySelectorAll('#form-services-selector .service-select-item.selected').forEach(item => {
    const qtyInput = item.querySelector('.service-qty-input');
    const qty = parseInt(qtyInput.value) || 1;
    const priceInput = item.querySelector('.service-price-input');
    const price = parseInt(priceInput.value) || 0;
    selectedServices.push({
      id: item.getAttribute('data-id'),
      name: item.getAttribute('data-name'),
      price: price,
      quantity: qty
    });
  });

  if (selectedServices.length === 0) {
    alert('Vui lòng chọn ít nhất một dịch vụ!');
    return;
  }

  // 1. Generate or retrieve Order ID for image uploading path
  let orderId = state.currentEditingOrder ? state.currentEditingOrder.id : null;
  if (!orderId) {
    let nextNum = 1001;
    if (state.orders.length > 0) {
      const numbers = state.orders.map(o => parseInt(o.id.replace('PB-', ''))).filter(n => !isNaN(n));
      if (numbers.length > 0) {
        nextNum = Math.max(...numbers) + 1;
      }
    }
    orderId = `PB-${nextNum}`;
  }

  // 2. Perform sequential image compression and uploads
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span style="display:inline-block; animation: spin 1s linear infinite; margin-right:6px;">⏳</span>Đang chuẩn bị ảnh...`;

  const progressContainer = document.getElementById('upload-progress-container');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-text');

  const uploadedImageUrls = [...state.tempExistingImages];
  const totalFiles = state.tempSelectedFiles.length;

  if (totalFiles > 0) {
    if (progressContainer) {
      progressContainer.style.display = 'block';
      progressFill.style.width = '0%';
      progressText.textContent = '0%';
    }

    for (let i = 0; i < totalFiles; i++) {
      const tempItem = state.tempSelectedFiles[i];
      submitBtn.innerHTML = `Đang tải ảnh ${i + 1}/${totalFiles}...`;

      try {
        // Compress the image
        const compressed = await compressImage(tempItem.file);
        
        if (window.storage) {
          // Firebase Storage upload
          const storageRef = window.storage.ref().child(`orders/${orderId}/${Date.now()}-${tempItem.file.name}`);
          const uploadTask = storageRef.put(compressed);
          
          await new Promise((resolveUpload, rejectUpload) => {
            uploadTask.on('state_changed', 
              (snapshot) => {
                const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const overallProgress = Math.round(((i / totalFiles) * 100) + (fileProgress / totalFiles));
                if (progressFill) progressFill.style.width = `${overallProgress}%`;
                if (progressText) progressText.textContent = `${overallProgress}%`;
              }, 
              (err) => {
                console.error("Firebase Storage Upload Error:", err);
                rejectUpload(err);
              }, 
              async () => {
                const downloadUrl = await uploadTask.snapshot.ref.getDownloadURL();
                uploadedImageUrls.push(downloadUrl);
                resolveUpload();
              }
            );
          });
        } else {
          // LocalStorage fallback (compressed Base64)
          uploadedImageUrls.push(compressed);
          const overallProgress = Math.round(((i + 1) / totalFiles) * 100);
          if (progressFill) progressFill.style.width = `${overallProgress}%`;
          if (progressText) progressText.textContent = `${overallProgress}%`;
        }
      } catch (err) {
        console.error("Compression/Upload failed for file:", tempItem.file.name, err);
      }
    }
  }

  if (progressFill) progressFill.style.width = '100%';
  if (progressText) progressText.textContent = '100%';
  submitBtn.innerHTML = `Đang lưu đơn hàng...`;

  try {
    let orderToSync = null;

    if (state.currentEditingOrder) {
      // Edit
      const order = state.orders.find(o => o.id === state.currentEditingOrder.id);
      if (!order) {
        throw new Error(`Không tìm thấy đơn hàng cần sửa: ${state.currentEditingOrder.id}`);
      }
      order.customerName = custName;
      order.customerPhone = custPhone;
      order.shoeInfo = shoeInfo;
      order.notes = notes;
      order.services = selectedServices;
      order.totalPrice = totalPrice;
      order.images = uploadedImageUrls;
      
      const newStatus = document.getElementById('order-status').value;
      if (newStatus !== order.status) {
        order.status = newStatus;
        if (['completed', 'delivered', 'paid'].includes(newStatus)) {
          order.completedDate = new Date().toISOString();
        } else {
          order.completedDate = null;
        }
      }

      orderToSync = order;
      alert(`Cập nhật đơn hàng ${order.id} thành công!`);
    } else {
      // Create new
      const statusVal = document.getElementById('order-status').value || 'pending';
      const isCompleted = ['completed', 'delivered', 'paid'].includes(statusVal);

      const newOrder = {
        id: orderId,
        customerName: custName,
        customerPhone: custPhone,
        shoeInfo: shoeInfo,
        services: selectedServices,
        totalPrice: totalPrice,
        status: statusVal,
        notes: notes,
        images: uploadedImageUrls,
        receivedDate: new Date().toISOString(),
        completedDate: isCompleted ? new Date().toISOString() : null,
        staffId: state.currentUser ? state.currentUser.id : 'system',
        staffName: state.currentUser ? state.currentUser.name : 'Nhân viên hệ thống'
      };

      state.orders.push(newOrder);
      orderToSync = newOrder;
      alert(`Tạo đơn hàng ${orderId} thành công!`);
    }

    saveState('pb_v2_orders', state.orders);

    // Sync specific order to Firebase Cloud
    if (window.db && orderToSync) {
      window.db.collection('v2_orders').doc(orderToSync.id).set(orderToSync)
        .then(() => console.log(`Synced order ${orderToSync.id} to Firebase V2.`))
        .catch(err => {
          console.error("Error syncing order to Firebase V2:", err);
          alert(`Đồng bộ dữ liệu lên Firebase V2 thất bại (đã lưu tạm trên máy): ${err.message}`);
        });
    }
  } catch (err) {
    console.error("Lỗi khi xử lý lưu đơn hàng:", err);
    alert(`Không thể lưu đơn hàng. Chi tiết lỗi: ${err.message}`);
  } finally {
    // Clear file references
    state.tempSelectedFiles.forEach(item => URL.revokeObjectURL(item.previewUrl));
    state.tempSelectedFiles = [];
    state.tempExistingImages = [];

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    if (progressContainer) progressContainer.style.display = 'none';

    closeOrderModal();
    renderOrders();
  }
}

function deleteOrder(orderId) {
  if (confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${orderId}?`)) {
    state.orders = state.orders.filter(o => o.id !== orderId);
    saveState('pb_v2_orders', state.orders);
    
    // Delete from Firebase Cloud
    if (window.db) {
      window.db.collection('v2_orders').doc(orderId).delete()
        .then(() => console.log(`Deleted order ${orderId} from Firebase Cloud V2.`))
        .catch(err => console.error("Error deleting order from Firebase V2:", err));
    }
    
    renderOrders();
  }
}

// 5. DETAIL VIEW & RECEIPT PRINT
function viewOrderDetail(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  // Fill in detail modal
  document.getElementById('det-order-id').textContent = order.id;
  
  // Status label
  let statusText = 'Chờ xử lý';
  let badgeClass = 'badge-pending';
  switch (order.status) {
    case 'pending': statusText = 'Chờ xử lý'; badgeClass = 'badge-pending'; break;
    case 'processing': statusText = 'Đang tiến hành'; badgeClass = 'badge-processing'; break;
    case 'completed': statusText = 'Đã hoàn thành'; badgeClass = 'badge-completed'; break;
    case 'paid': statusText = 'Đã thanh toán'; badgeClass = 'badge-paid'; break;
    case 'delivered': statusText = 'Đã giao khách'; badgeClass = 'badge-delivered'; break;
    case 'cancelled': statusText = 'Đã hủy'; badgeClass = 'badge-cancelled'; break;
  }
  
  const statusBadge = document.getElementById('det-status');
  statusBadge.className = `badge ${badgeClass}`;
  statusBadge.textContent = statusText;

  document.getElementById('det-cust-name').textContent = order.customerName;
  document.getElementById('det-cust-phone').textContent = order.customerPhone;
  document.getElementById('det-shoe-info').textContent = order.shoeInfo || '-';
  document.getElementById('det-received-date').textContent = formatDateTime(order.receivedDate);
  document.getElementById('det-completed-date').textContent = formatDateTime(order.completedDate);
  document.getElementById('det-staff').textContent = order.staffName || 'Chưa phân công';
  document.getElementById('det-notes').textContent = order.notes || 'Không có ghi chú';
  document.getElementById('det-total-price').textContent = formatVND(order.totalPrice);

  // Populate services list
  const servicesList = document.getElementById('det-services-list');
  servicesList.innerHTML = '';
  order.services.forEach(s => {
    const qty = s.quantity || 1;
    const li = document.createElement('li');
    li.className = 'receipt-service-item';
    li.innerHTML = `
      <span>${s.name} ${qty > 1 ? `<span style="color: var(--text-secondary); font-weight: 500;">(x${qty})</span>` : ''}</span>
      <span style="font-weight: 600;">${formatVND(s.price * qty)}</span>
    `;
    servicesList.appendChild(li);
  });

  // Prepare printing area data
  document.getElementById('print-receipt-id').textContent = order.id;
  document.getElementById('print-date').textContent = formatDateTime(new Date());
  document.getElementById('print-cust-name').textContent = order.customerName;
  document.getElementById('print-cust-phone').textContent = order.customerPhone;
  document.getElementById('print-shoe-info').textContent = order.shoeInfo || '-';
  document.getElementById('print-notes').textContent = order.notes || 'Không có';
  
  const printTableBody = document.getElementById('print-services-body');
  printTableBody.innerHTML = '';
  order.services.forEach(s => {
    const qty = s.quantity || 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.name} ${qty > 1 ? `(x${qty})` : ''}</td>
      <td style="text-align: right;">${formatVND(s.price * qty)}</td>
    `;
    printTableBody.appendChild(tr);
  });
  document.getElementById('print-total-price').textContent = formatVND(order.totalPrice);

  // Store for printing trigger
  state.currentEditingOrder = order;

  // Toggle Quick Pay button display
  const payBtn = document.getElementById('btn-detail-pay');
  if (payBtn) {
    if (['pending', 'processing', 'completed'].includes(order.status)) {
      payBtn.style.display = 'inline-flex';
    } else {
      payBtn.style.display = 'none';
    }
  }

  // Open modal
  document.getElementById('detail-modal').classList.add('active');

  // Render detail gallery
  const gallerySection = document.getElementById('det-gallery-section');
  const galleryContainer = document.getElementById('det-images-gallery');
  if (gallerySection && galleryContainer) {
    if (order.images && order.images.length > 0) {
      gallerySection.style.display = 'block';
      galleryContainer.innerHTML = '';
      order.images.forEach(url => {
        const div = document.createElement('div');
        div.className = 'detail-image-wrapper';
        div.innerHTML = `<img src="${url}" class="detail-gallery-img" onclick="openLightbox('${url}')" title="Xem ảnh lớn">`;
        galleryContainer.appendChild(div);
      });
    } else {
      gallerySection.style.display = 'none';
    }
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('active');
}

function printReceipt() {
  window.print();
}

function quickPayOrder() {
  if (!state.currentEditingOrder) return;
  const orderId = state.currentEditingOrder.id;
  quickPayOrderLogic(orderId);
  closeDetailModal();
}

function quickPayOrderFromTable(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (order) {
    if (confirm(`Xác nhận thanh toán cho đơn hàng ${orderId} (${formatVND(order.totalPrice)})?`)) {
      quickPayOrderLogic(orderId);
    }
  }
}

function quickPayOrderLogic(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (order) {
    order.status = 'paid';
    order.completedDate = new Date().toISOString();
    saveState('pb_v2_orders', state.orders);

    // Sync status change to Firebase Cloud V2
    if (window.db) {
      window.db.collection('v2_orders').doc(orderId).set(order)
        .then(() => console.log(`Paid status for order ${orderId} synced to Firebase V2.`))
        .catch(err => console.error("Error syncing order to Firebase V2:", err));
    }

    renderOrders();
    if (state.activeView === 'dashboard') {
      renderDashboard();
    }
  }
}

// 6. SERVICE SETTINGS CRUD
function renderServicesList() {
  const grid = document.getElementById('services-grid');
  grid.innerHTML = '';

  state.services.forEach(s => {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.innerHTML = `
      <div>
        <div class="service-card-header">
          <span class="service-card-cat">${s.category}</span>
        </div>
        <h4 class="service-card-title">${s.name}</h4>
        <div style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 8px;">Khoảng giá: ${s.priceRange}</div>
      </div>
      <div>
        <div class="service-card-price">${formatVND(s.defaultPrice)}</div>
        <div class="service-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="openServiceModal('${s.id}')">Sửa</button>
          <button class="btn btn-danger btn-sm" onclick="deleteService('${s.id}')">Xóa</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function openServiceModal(serviceId = null) {
  const modal = document.getElementById('service-modal');
  const title = document.getElementById('service-modal-title');
  const form = document.getElementById('service-form');
  
  form.reset();
  state.currentEditingService = null;

  if (serviceId) {
    state.currentEditingService = state.services.find(s => s.id === serviceId);
    title.textContent = 'Chỉnh Sửa Dịch Vụ';
    document.getElementById('service-name').value = state.currentEditingService.name;
    document.getElementById('service-category').value = state.currentEditingService.category;
    document.getElementById('service-price').value = state.currentEditingService.defaultPrice;
    document.getElementById('service-range').value = state.currentEditingService.priceRange;
  } else {
    title.textContent = 'Thêm Dịch Vụ Mới';
  }

  modal.classList.add('active');
}

function closeServiceModal() {
  document.getElementById('service-modal').classList.remove('active');
}

function handleServiceSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('service-name').value.trim();
  const category = document.getElementById('service-category').value;
  const price = parseInt(document.getElementById('service-price').value) || 0;
  const range = document.getElementById('service-range').value.trim();

  let serviceToSync = null;

  if (state.currentEditingService) {
    const s = state.services.find(serv => serv.id === state.currentEditingService.id);
    s.name = name;
    s.category = category;
    s.defaultPrice = price;
    s.priceRange = range || `${formatVND(price)}`;
    serviceToSync = s;
    alert('Cập nhật dịch vụ thành công!');
  } else {
    const id = 's-' + Date.now();
    const newService = {
      id: id,
      name: name,
      category: category,
      defaultPrice: price,
      priceRange: range || `${formatVND(price)}`
    };
    state.services.push(newService);
    serviceToSync = newService;
    alert('Thêm dịch vụ mới thành công!');
  }

  saveState('pb_v2_services', state.services);

  // Sync service to Firebase Cloud V2
  if (window.db && serviceToSync) {
    window.db.collection('v2_services').doc(serviceToSync.id).set(serviceToSync)
      .then(() => console.log(`Synced service ${serviceToSync.id} to Firebase V2.`))
      .catch(err => console.error("Error syncing service to Firebase V2:", err));
  }

  closeServiceModal();
  renderServicesList();
}

function deleteService(serviceId) {
  if (confirm('Bạn có chắc muốn xóa dịch vụ này? Sẽ không ảnh hưởng đến đơn hàng cũ.')) {
    state.services = state.services.filter(s => s.id !== serviceId);
    saveState('pb_v2_services', state.services);
    
    // Delete from Firebase Cloud V2
    if (window.db) {
      window.db.collection('v2_services').doc(serviceId).delete()
        .then(() => console.log(`Deleted service ${serviceId} from Firebase Cloud V2.`))
        .catch(err => console.error("Error deleting service from Firebase V2:", err));
    }
    
    renderServicesList();
  }
}

// 7. EMPLOYEE MANAGEMENT CRUD
function renderEmployeesList() {
  const grid = document.getElementById('employees-grid');
  grid.innerHTML = '';

  state.users.forEach(u => {
    const card = document.createElement('div');
    card.className = 'employee-card';
    card.innerHTML = `
      <div class="employee-avatar">${u.name.split(' ').pop().substring(0, 2).toUpperCase()}</div>
      <div class="employee-details">
        <div class="employee-name">${u.name}</div>
        <div class="employee-email">${u.email}</div>
        <span class="employee-role-badge">${u.role === 'admin' ? 'Quản trị' : 'Nhân viên'}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
        <button class="btn btn-secondary btn-sm" onclick="openEmployeeModal('${u.id}')">Sửa</button>
        ${u.id !== 'u-admin' ? `
          <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${u.id}')">Xóa</button>
        ` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

function openEmployeeModal(userId = null) {
  const modal = document.getElementById('employee-modal');
  const title = document.getElementById('employee-modal-title');
  const submitBtn = document.getElementById('employee-submit-btn');
  const form = document.getElementById('employee-form');
  const roleSelect = document.getElementById('emp-role');
  
  form.reset();
  state.currentEditingEmployee = null;
  roleSelect.disabled = false;

  if (userId) {
    state.currentEditingEmployee = state.users.find(u => u.id === userId);
    title.textContent = 'Chỉnh Sửa Tài Khoản';
    submitBtn.textContent = 'Lưu thay đổi';
    
    // Fill in form values
    document.getElementById('emp-name').value = state.currentEditingEmployee.name;
    document.getElementById('emp-email').value = state.currentEditingEmployee.email;
    document.getElementById('emp-password').value = state.currentEditingEmployee.password;
    roleSelect.value = state.currentEditingEmployee.role;

    // Do not allow main admin to change their own role to prevent lockout
    if (userId === 'u-admin') {
      roleSelect.disabled = true;
    }
  } else {
    title.textContent = 'Thêm Tài Khoản Nhân Viên Mới';
    submitBtn.textContent = 'Tạo tài khoản';
  }

  modal.classList.add('active');
}

function closeEmployeeModal() {
  document.getElementById('emp-role').disabled = false;
  document.getElementById('employee-modal').classList.remove('active');
}

function handleEmployeeSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('emp-name').value.trim();
  const email = document.getElementById('emp-email').value.trim();
  const password = document.getElementById('emp-password').value;
  const role = document.getElementById('emp-role').value;

  let employeeToSync = null;

  if (state.currentEditingEmployee) {
    // Editing
    const isEmailTaken = state.users.some(u => u.email === email && u.id !== state.currentEditingEmployee.id);
    if (isEmailTaken) {
      alert('Email này đã tồn tại trong hệ thống!');
      return;
    }

    const u = state.users.find(user => user.id === state.currentEditingEmployee.id);
    u.name = name;
    u.email = email;
    u.password = password;
    
    // Only update role if it wasn't disabled (i.e. not main admin)
    if (u.id !== 'u-admin') {
      u.role = role;
    }

    // If editing self, update currentUser in state and localStorage
    if (state.currentUser && state.currentUser.id === u.id) {
      state.currentUser = { ...u };
      saveState('pb_v2_current_user', state.currentUser);
      updateProfileUI();
    }

    employeeToSync = u;
    alert('Cập nhật tài khoản thành công!');
  } else {
    // Creating
    if (state.users.some(u => u.email === email)) {
      alert('Email này đã tồn tại trong hệ thống!');
      return;
    }

    const newEmp = {
      id: 'u-' + Date.now(),
      name: name,
      email: email,
      password: password,
      role: role
    };
    state.users.push(newEmp);
    employeeToSync = newEmp;
    alert('Thêm tài khoản nhân viên thành công!');
  }

  saveState('pb_v2_users', state.users);

  // Sync employee to Firebase Cloud V2
  if (window.db && employeeToSync) {
    window.db.collection('v2_users').doc(employeeToSync.id).set(employeeToSync)
      .then(() => console.log(`Synced user ${employeeToSync.id} to Firebase V2.`))
      .catch(err => console.error("Error syncing user to Firebase V2:", err));
  }

  closeEmployeeModal();
  renderEmployeesList();
}

function deleteEmployee(userId) {
  if (confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
    state.users = state.users.filter(u => u.id !== userId);
    saveState('pb_v2_users', state.users);
    
    // Delete from Firebase Cloud V2
    if (window.db) {
      window.db.collection('v2_users').doc(userId).delete()
        .then(() => console.log(`Deleted user ${userId} from Firebase Cloud V2.`))
        .catch(err => console.error("Error deleting user from Firebase V2:", err));
    }
    
    renderEmployeesList();
  }
}

// 8. CUSTOMER MANAGEMENT
function renderCustomers() {
  const searchTerm = document.getElementById('search-customer').value.toLowerCase();
  const tbody = document.getElementById('customers-table-body');
  tbody.innerHTML = '';

  const customerMap = {};
  state.orders.forEach(o => {
    const phone = o.customerPhone.trim();
    if (!phone) return;
    if (!customerMap[phone]) {
      customerMap[phone] = {
        name: o.customerName,
        phone: phone,
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: o.receivedDate
      };
    }
    customerMap[phone].orderCount++;
    customerMap[phone].totalSpent += o.totalPrice;
    if (new Date(o.receivedDate) > new Date(customerMap[phone].lastOrderDate)) {
      customerMap[phone].lastOrderDate = o.receivedDate;
      customerMap[phone].name = o.customerName;
    }
  });

  let customers = Object.values(customerMap);

  if (searchTerm) {
    customers = customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm) || 
      c.phone.includes(searchTerm)
    );
  }

  customers.sort((a, b) => b.totalSpent - a.totalSpent);

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 30px; color: var(--text-light);">Không tìm thấy khách hàng nào</td></tr>`;
    return;
  }

  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-brand-brown-dark);">${c.name}</td>
      <td style="font-weight: 600;">${c.phone}</td>
      <td style="font-weight: 700; text-align: center; color: var(--text-secondary);">${c.orderCount}</td>
      <td style="font-weight: 700; color: var(--color-brand-gold);">${formatVND(c.totalSpent)}</td>
      <td style="font-size: 0.85rem; color: var(--text-secondary);">${formatDateTime(c.lastOrderDate)}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit" onclick="viewCustomerDetail('${c.phone}')" title="Xem lịch sử mua hàng">
            <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function viewCustomerDetail(phone) {
  const customerOrders = state.orders.filter(o => o.customerPhone.trim() === phone.trim());
  if (customerOrders.length === 0) return;

  customerOrders.sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate));

  const customerName = customerOrders[0].customerName;
  const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalPrice, 0);

  document.getElementById('cust-det-name').textContent = customerName;
  document.getElementById('cust-det-phone').textContent = phone;
  document.getElementById('cust-det-orders-count').textContent = customerOrders.length;
  document.getElementById('cust-det-spent').textContent = formatVND(totalSpent);

  const tbody = document.getElementById('cust-det-orders-table-body');
  tbody.innerHTML = '';

  customerOrders.forEach(o => {
    const tr = document.createElement('tr');
    
    let statusText = 'Chờ xử lý';
    let badgeClass = 'badge-pending';
    switch (o.status) {
      case 'pending': statusText = 'Chờ xử lý'; badgeClass = 'badge-pending'; break;
      case 'processing': statusText = 'Đang tiến hành'; badgeClass = 'badge-processing'; break;
      case 'completed': statusText = 'Đã hoàn thành'; badgeClass = 'badge-completed'; break;
      case 'paid': statusText = 'Đã thanh toán'; badgeClass = 'badge-paid'; break;
      case 'delivered': statusText = 'Đã giao khách'; badgeClass = 'badge-delivered'; break;
      case 'cancelled': statusText = 'Đã hủy'; badgeClass = 'badge-cancelled'; break;
    }

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-brand-brown-dark);">${o.id}</td>
      <td>
        <div style="font-weight: 600;">${o.shoeInfo || '-'}</div>
        <div style="font-size: 0.8rem; color: var(--text-light);">${o.services.map(s => s.name).join(', ')}</div>
      </td>
      <td style="font-weight: 700; color: var(--color-brand-gold);">${formatVND(o.totalPrice)}</td>
      <td style="font-size: 0.8rem; color: var(--text-secondary);">${formatDateTime(o.receivedDate)}</td>
      <td><span class="badge ${badgeClass}">${statusText}</span></td>
      <td>
        <button class="action-btn edit" onclick="closeCustomerDetailModal(); viewOrderDetail('${o.id}')" title="Xem chi tiết đơn hàng">
          <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('customer-detail-modal').classList.add('active');
}

function closeCustomerDetailModal() {
  document.getElementById('customer-detail-modal').classList.remove('active');
}

// 9. DASHBOARD / ANALYTICS CHARTS (PURE HTML5 CANVAS)
function renderDashboard() {
  const dbFilterDate = document.getElementById('db-filter-date').value;
  const dbFilterMonth = document.getElementById('db-filter-month').value;
  const dbFilterYear = document.getElementById('db-filter-year').value;

  // Filter orders based on day, month, year
  const filteredOrders = state.orders.filter(o => isDateMatch(o.receivedDate, dbFilterDate, dbFilterMonth, dbFilterYear));

  // Statistics Calculations
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(o => ['completed', 'delivered', 'paid'].includes(o.status)).length;
  const activeOrders = filteredOrders.filter(o => ['pending', 'processing'].includes(o.status)).length;
  
  const expectedRevenue = filteredOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalPrice, 0);

  const realizedRevenue = filteredOrders
    .filter(o => ['paid', 'delivered'].includes(o.status))
    .reduce((sum, o) => sum + o.totalPrice, 0);

  // Update DOM stats
  document.getElementById('stat-total-orders').textContent = totalOrders;
  document.getElementById('stat-active-orders').textContent = activeOrders;
  document.getElementById('stat-completed-orders').textContent = completedOrders;
  document.getElementById('stat-revenue-expected').textContent = formatVND(expectedRevenue);
  document.getElementById('stat-revenue-realized').textContent = formatVND(realizedRevenue);

  // Render Canvas Charts using the filtered list
  drawRevenueTrendChart(filteredOrders);
  drawPopularServicesChart(filteredOrders);
}

function drawRevenueTrendChart(filteredOrders) {
  const canvas = document.getElementById('chart-revenue');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Set dimensions dynamically based on container
  const rect = canvas.parentNode.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 260;

  const width = canvas.width;
  const height = canvas.height;
  const padding = 50;

  ctx.clearRect(0, 0, width, height);

  const dbFilterMonth = document.getElementById('db-filter-month').value;
  const dbFilterYear = document.getElementById('db-filter-year').value;

  let dataPoints = [];

  if (dbFilterMonth !== 'all' && dbFilterYear !== 'all') {
    // Show daily revenue for that month
    const year = parseInt(dbFilterYear);
    const month = parseInt(dbFilterMonth);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      dataPoints.push({
        dayNum: day,
        label: `${day}`,
        expected: 0,
        realized: 0
      });
    }

    filteredOrders.forEach(o => {
      // Map based on receivedDate for expected, completedDate for realized
      const rDate = new Date(o.receivedDate);
      if (o.status !== 'cancelled' && rDate.getFullYear() === year && (rDate.getMonth() + 1) === month) {
        const dayData = dataPoints.find(dp => dp.dayNum === rDate.getDate());
        if (dayData) dayData.expected += o.totalPrice;
      }
      
      if (['paid', 'delivered'].includes(o.status) && o.completedDate) {
        const cDate = new Date(o.completedDate);
        if (cDate.getFullYear() === year && (cDate.getMonth() + 1) === month) {
          const dayData = dataPoints.find(dp => dp.dayNum === cDate.getDate());
          if (dayData) dayData.realized += o.totalPrice;
        }
      }
    });
  } else if (dbFilterYear !== 'all') {
    // Show monthly revenue for that year
    const year = parseInt(dbFilterYear);
    for (let m = 1; m <= 12; m++) {
      dataPoints.push({
        monthNum: m,
        label: `T${m}`,
        expected: 0,
        realized: 0
      });
    }

    filteredOrders.forEach(o => {
      const rDate = new Date(o.receivedDate);
      if (o.status !== 'cancelled' && rDate.getFullYear() === year) {
        const monthData = dataPoints.find(dp => dp.monthNum === (rDate.getMonth() + 1));
        if (monthData) monthData.expected += o.totalPrice;
      }
      
      if (['paid', 'delivered'].includes(o.status) && o.completedDate) {
        const cDate = new Date(o.completedDate);
        if (cDate.getFullYear() === year) {
          const monthData = dataPoints.find(dp => dp.monthNum === (cDate.getMonth() + 1));
          if (monthData) monthData.realized += o.totalPrice;
        }
      }
    });
  } else {
    // Default: Last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dataPoints.push({
        dateStr: d.toISOString().split('T')[0],
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        expected: 0,
        realized: 0
      });
    }

    filteredOrders.forEach(o => {
      const rDateStr = o.receivedDate.split('T')[0];
      const rDay = dataPoints.find(d => d.dateStr === rDateStr);
      if (o.status !== 'cancelled' && rDay) {
        rDay.expected += o.totalPrice;
      }
      
      if (['paid', 'delivered'].includes(o.status) && o.completedDate) {
        const cDateStr = o.completedDate.split('T')[0];
        const cDay = dataPoints.find(d => d.dateStr === cDateStr);
        if (cDay) {
          cDay.realized += o.totalPrice;
        }
      }
    });
  }

  const maxRevenue = Math.max(...dataPoints.map(d => Math.max(d.expected, d.realized)), 100000); // min 100k scale

  // Draw Grid Lines & Labels
  ctx.strokeStyle = '#EADFD5';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#706054';
  ctx.font = '10px Montserrat';
  ctx.textAlign = 'right';

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = (maxRevenue / gridSteps) * i;
    const y = height - padding - ((height - 2 * padding) / gridSteps) * i;
    
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();

    ctx.fillText(formatVND(val).replace('₫', '').trim(), padding - 10, y + 4);
  }

  // Draw X labels
  ctx.textAlign = 'center';
  const pointsCount = dataPoints.length;
  const labelInterval = pointsCount > 15 ? 3 : 1;
  const pointSpacing = (width - 2 * padding) / (pointsCount - 1 || 1);

  dataPoints.forEach((d, idx) => {
    const x = padding + pointSpacing * idx;
    if (idx % labelInterval === 0 || idx === pointsCount - 1) {
      ctx.fillText(d.label, x, height - padding + 20);
    }
  });

  // 1. Plot expected line (dashed, muted)
  ctx.strokeStyle = '#B8A89C'; // Muted grey/brown
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]); // dashed line for provisional/expected
  ctx.beginPath();
  
  const expectedPoints = dataPoints.map((d, idx) => {
    const x = padding + pointSpacing * idx;
    const y = height - padding - ((height - 2 * padding) * d.expected) / maxRevenue;
    return { x, y };
  });

  expectedPoints.forEach((pt, idx) => {
    if (idx === 0) {
      ctx.moveTo(pt.x, pt.y);
    } else {
      ctx.lineTo(pt.x, pt.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]); // Reset dashed line style

  // 2. Plot realized line (solid, gold)
  ctx.strokeStyle = '#E89C19'; // Brand Gold
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  const realizedPoints = dataPoints.map((d, idx) => {
    const x = padding + pointSpacing * idx;
    const y = height - padding - ((height - 2 * padding) * d.realized) / maxRevenue;
    return { x, y };
  });

  realizedPoints.forEach((pt, idx) => {
    if (idx === 0) {
      ctx.moveTo(pt.x, pt.y);
    } else {
      ctx.lineTo(pt.x, pt.y);
    }
  });
  ctx.stroke();

  // Draw area gradient for realized
  const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
  gradient.addColorStop(0, 'rgba(232, 156, 25, 0.25)');
  gradient.addColorStop(1, 'rgba(232, 156, 25, 0.0)');
  ctx.fillStyle = gradient;
  
  ctx.beginPath();
  ctx.moveTo(realizedPoints[0].x, height - padding);
  realizedPoints.forEach(pt => ctx.lineTo(pt.x, pt.y));
  ctx.lineTo(realizedPoints[realizedPoints.length - 1].x, height - padding);
  ctx.closePath();
  ctx.fill();

  // Draw points circles if count <= 12
  if (pointsCount <= 12) {
    // Expected circles
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#B8A89C';
    ctx.lineWidth = 2;
    expectedPoints.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Realized circles & labels
    ctx.fillStyle = '#4A3728';
    ctx.strokeStyle = '#E89C19';
    ctx.lineWidth = 2;

    realizedPoints.forEach((pt, idx) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (dataPoints[idx].realized > 0) {
        ctx.fillStyle = '#2C2018';
        ctx.font = 'bold 9px Montserrat';
        ctx.fillText(formatVND(dataPoints[idx].realized).replace('₫', '').trim(), pt.x, pt.y - 12);
      }
    });
  }
}

function drawPopularServicesChart(filteredOrders) {
  const canvas = document.getElementById('chart-services');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const rect = canvas.parentNode.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 260;

  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;

  ctx.clearRect(0, 0, width, height);

  const serviceStats = {};
  filteredOrders.forEach(o => {
    o.services.forEach(s => {
      serviceStats[s.name] = (serviceStats[s.name] || 0) + 1;
    });
  });

  const popular = Object.keys(serviceStats)
    .map(name => ({ name, count: serviceStats[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // top 5

  if (popular.length === 0) {
    ctx.fillStyle = '#9B8E85';
    ctx.font = '14px Montserrat';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu dịch vụ', width / 2, height / 2);
    return;
  }

  // Draw Pie/Doughnut Chart
  const centerX = width / 2;
  const centerY = height / 2 - 10;
  const radius = Math.min(width, height) / 2 - 50;

  let totalCount = popular.reduce((sum, item) => sum + item.count, 0);
  let startAngle = -Math.PI / 2;

  const colors = ['#E89C19', '#4A3728', '#6E533F', '#A08068', '#C6A995'];

  // Draw Slices
  popular.forEach((item, idx) => {
    const sliceAngle = (item.count / totalCount) * 2 * Math.PI;
    
    ctx.fillStyle = colors[idx % colors.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Draw Inner circle (Doughnut style)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Draw Legend at the bottom
  ctx.font = '9px Montserrat';
  ctx.textAlign = 'left';
  
  const legendYStart = height - 35;
  const itemWidth = width / popular.length;

  popular.forEach((item, idx) => {
    const x = itemWidth * idx + 10;
    
    // Color square
    ctx.fillStyle = colors[idx % colors.length];
    ctx.fillRect(x, legendYStart, 8, 8);

    // Label
    ctx.fillStyle = '#2C2018';
    ctx.fillText(`${item.name.substring(0, 10)}... (${item.count})`, x + 14, legendYStart + 8);
  });
}

// 9. WINDOWS / EVENT HANDLERS INIT
window.addEventListener('DOMContentLoaded', () => {
  // Set default dashboard filters to current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const dbMonthSelect = document.getElementById('db-filter-month');
  const dbYearSelect = document.getElementById('db-filter-year');
  if (dbMonthSelect) dbMonthSelect.value = currentMonth.toString();
  if (dbYearSelect) {
    let optionExists = false;
    for (let i = 0; i < dbYearSelect.options.length; i++) {
      if (dbYearSelect.options[i].value === currentYear.toString()) {
        optionExists = true;
        break;
      }
    }
    if (!optionExists) {
      const opt = document.createElement('option');
      opt.value = currentYear.toString();
      opt.textContent = currentYear.toString();
      dbYearSelect.appendChild(opt);
    }
    dbYearSelect.value = currentYear.toString();
  }

  initData();
  
  // Navigation listeners
  document.querySelectorAll('.sidebar-menu li').forEach(li => {
    li.addEventListener('click', () => {
      const view = li.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  
  // Order search and filters
  document.getElementById('search-order').addEventListener('input', renderOrders);
  document.getElementById('filter-status').addEventListener('change', renderOrders);
  document.getElementById('filter-date').addEventListener('change', renderOrders);
  document.getElementById('filter-month').addEventListener('change', renderOrders);
  document.getElementById('filter-year').addEventListener('change', renderOrders);

  // Reset order filters
  document.getElementById('btn-reset-order-filters').addEventListener('click', () => {
    document.getElementById('search-order').value = '';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-month').value = 'all';
    document.getElementById('filter-year').value = 'all';
    renderOrders();
  });

  // Customer filters
  const searchCust = document.getElementById('search-customer');
  if (searchCust) {
    searchCust.addEventListener('input', renderCustomers);
  }
  const resetCust = document.getElementById('btn-reset-customer-filters');
  if (resetCust) {
    resetCust.addEventListener('click', () => {
      document.getElementById('search-customer').value = '';
      renderCustomers();
    });
  }

  // Dashboard filters
  document.getElementById('db-filter-date').addEventListener('change', renderDashboard);
  document.getElementById('db-filter-month').addEventListener('change', renderDashboard);
  document.getElementById('db-filter-year').addEventListener('change', renderDashboard);

  // Reset dashboard filters
  document.getElementById('btn-reset-db-filters').addEventListener('click', () => {
    document.getElementById('db-filter-date').value = '';
    document.getElementById('db-filter-month').value = currentMonth.toString();
    document.getElementById('db-filter-year').value = currentYear.toString();
    renderDashboard();
  });

  // Resize charts on window resize
  window.addEventListener('resize', () => {
    if (state.activeView === 'dashboard') {
      renderDashboard();
    }
  });
});

// 10. PUBLIC ORDER TRACKING & TOAST FUNCTIONS
async function loadPublicTracking(orderId) {
  const trackingContainer = document.getElementById('view-public-tracking');
  if (!trackingContainer) return;
  
  document.getElementById('track-order-id').textContent = orderId;
  
  let order = null;
  
  if (window.db) {
    try {
      const doc = await window.db.collection('v2_orders').doc(orderId).get();
      if (doc.exists) {
        order = doc.data();
      }
    } catch (error) {
      console.error("Error fetching order from Firestore V2 for tracking:", error);
    }
  }
  
  // Fallback to LocalStorage / State if offline or not found
  if (!order) {
    if (state.orders.length === 0) {
      loadFromLocalStorage();
    }
    order = state.orders.find(o => o.id.toLowerCase() === orderId.toLowerCase());
  }
  
  if (!order) {
    displayTrackingError(orderId, "Không tìm thấy đơn hàng này trên hệ thống. Vui lòng kiểm tra lại mã đơn hàng hoặc liên hệ hotline để được hỗ trợ.");
    return;
  }
  
  renderTrackingInfo(order);
}

function displayTrackingError(orderId, message) {
  const card = document.querySelector('#view-public-tracking .tracking-card');
  if (!card) return;
  
  card.innerHTML = `
    <div class="tracking-header">
      <div class="brand-logo">
        <h1>SPA GIÀY</h1>
        <p>SHOE SPA & REPAIR</p>
      </div>
      <div class="tracking-title-block">
        <h2>TRA CỨU TIẾN ĐỘ ĐƠN HÀNG</h2>
        <p>Mã đơn hàng: <span style="font-weight: 700; color: var(--status-cancelled-text);">${orderId}</span></p>
      </div>
    </div>
    
    <div class="text-center" style="padding: 40px 20px;">
      <svg viewBox="0 0 24 24" style="width: 64px; height: 64px; fill: var(--status-cancelled-text); margin-bottom: 16px;">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <h3 style="color: var(--color-brand-brown-dark); margin-bottom: 8px; font-weight: 700;">Không tìm thấy thông tin</h3>
      <p style="color: var(--text-secondary); margin-bottom: 24px; max-width: 400px; margin-left: auto; margin-right: auto;">${message}</p>
      <div style="display: flex; justify-content: center; gap: 12px;">
        <a href="tel:0906227512" class="btn btn-primary">Gọi Hotline Hỗ Trợ</a>
        <a href="https://zalo.me/0906227512" target="_blank" class="btn btn-secondary">Nhắn Zalo Shop</a>
      </div>
    </div>
  `;
}

function renderTrackingInfo(order) {
  document.getElementById('track-order-id').textContent = order.id;
  document.getElementById('track-cust-name').textContent = order.customerName;
  
  // Mask customer phone for security/privacy
  const rawPhone = order.customerPhone || '';
  let maskedPhone = rawPhone;
  if (rawPhone.length >= 8) {
    maskedPhone = rawPhone.substring(0, 4) + ' ••• ' + rawPhone.substring(rawPhone.length - 3);
  }
  document.getElementById('track-cust-phone').textContent = maskedPhone;
  
  document.getElementById('track-shoe-info').textContent = order.shoeInfo || 'Không có ghi chú model';
  document.getElementById('track-received-date').textContent = formatDateTime(order.receivedDate);
  document.getElementById('track-notes').textContent = order.notes || 'Không có ghi chú thêm.';
  document.getElementById('track-total-price').textContent = formatVND(order.totalPrice);
  
  // Populate services
  const servicesList = document.getElementById('track-services-list');
  servicesList.innerHTML = '';
  order.services.forEach(s => {
    const qty = s.quantity || 1;
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${s.name} ${qty > 1 ? `<span style="color: var(--text-light); font-weight: 500;">(x${qty})</span>` : ''}</span>
      <span style="font-weight: 600;">${formatVND(s.price * qty)}</span>
    `;
    servicesList.appendChild(li);
  });
  
  // Stepper timeline
  const stepPending = document.getElementById('step-pending');
  const stepProcessing = document.getElementById('step-processing');
  const stepCompleted = document.getElementById('step-completed');
  const stepDelivered = document.getElementById('step-delivered');
  
  const line1 = document.getElementById('line-1');
  const line2 = document.getElementById('line-2');
  const line3 = document.getElementById('line-3');
  
  const cancelledBanner = document.getElementById('track-cancelled-banner');
  const stepperContainer = document.querySelector('.tracking-stepper-container');
  
  // Reset
  [stepPending, stepProcessing, stepCompleted, stepDelivered].forEach(node => {
    node.classList.remove('active', 'completed');
  });
  [line1, line2, line3].forEach(line => {
    line.classList.remove('completed');
  });
  
  let statusText = 'Chờ xử lý';
  let badgeClass = 'badge-pending';
  
  if (order.status === 'cancelled') {
    statusText = 'Đã hủy';
    badgeClass = 'badge-cancelled';
    cancelledBanner.style.display = 'flex';
    stepperContainer.style.display = 'none';
  } else {
    cancelledBanner.style.display = 'none';
    stepperContainer.style.display = 'block';
    
    // Steps: 1: pending, 2: processing, 3: completed/paid, 4: delivered
    if (order.status === 'pending') {
      statusText = 'Chờ xử lý';
      badgeClass = 'badge-pending';
      stepPending.classList.add('active');
    } else if (order.status === 'processing') {
      statusText = 'Đang tiến hành';
      badgeClass = 'badge-processing';
      
      stepPending.classList.add('completed');
      line1.classList.add('completed');
      stepProcessing.classList.add('active');
    } else if (order.status === 'completed') {
      statusText = 'Đã hoàn thành';
      badgeClass = 'badge-completed';
      
      stepPending.classList.add('completed');
      line1.classList.add('completed');
      stepProcessing.classList.add('completed');
      line2.classList.add('completed');
      stepCompleted.classList.add('active');
    } else if (order.status === 'paid') {
      statusText = 'Đã thanh toán (Chờ nhận)';
      badgeClass = 'badge-paid';
      
      stepPending.classList.add('completed');
      line1.classList.add('completed');
      stepProcessing.classList.add('completed');
      line2.classList.add('completed');
      stepCompleted.classList.add('active');
    } else if (order.status === 'delivered') {
      statusText = 'Đã giao khách';
      badgeClass = 'badge-delivered';
      
      stepPending.classList.add('completed');
      line1.classList.add('completed');
      stepProcessing.classList.add('completed');
      line2.classList.add('completed');
      stepCompleted.classList.add('completed');
      line3.classList.add('completed');
      stepDelivered.classList.add('active');
    }
  }
  
  const statusBadge = document.getElementById('track-status-badge');
  statusBadge.textContent = statusText;
  statusBadge.className = `badge ${badgeClass}`;

  // Render public tracking image gallery
  const trackGalleryCard = document.getElementById('track-gallery-card');
  const trackGalleryContainer = document.getElementById('track-images-gallery');
  if (trackGalleryCard && trackGalleryContainer) {
    if (order.images && order.images.length > 0) {
      trackGalleryCard.style.display = 'block';
      trackGalleryContainer.innerHTML = '';
      order.images.forEach(url => {
        const div = document.createElement('div');
        div.className = 'detail-image-wrapper';
        div.innerHTML = `<img src="${url}" class="detail-gallery-img" onclick="openLightbox('${url}')" title="Click để phóng to">`;
        trackGalleryContainer.appendChild(div);
      });
    } else {
      trackGalleryCard.style.display = 'none';
    }
  }
}

// Image Selection & Compression & Lightbox Helpers
function handleOrderImagesSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  files.forEach(file => {
    const previewUrl = URL.createObjectURL(file);
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    state.tempSelectedFiles.push({
      id: tempId,
      file: file,
      previewUrl: previewUrl
    });
  });
  
  renderOrderFormImagesPreview();
  e.target.value = '';
}

function renderOrderFormImagesPreview() {
  const container = document.getElementById('order-images-preview-container');
  if (!container) return;
  container.innerHTML = '';
  
  // Render existing images
  state.tempExistingImages.forEach((url, index) => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    div.innerHTML = `
      <img src="${url}">
      <button type="button" class="image-preview-delete" onclick="deleteExistingOrderImage(${index})">&times;</button>
    `;
    container.appendChild(div);
  });
  
  // Render new temporary selected images
  state.tempSelectedFiles.forEach(item => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    div.innerHTML = `
      <img src="${item.previewUrl}">
      <button type="button" class="image-preview-delete" onclick="deleteTempOrderImage('${item.id}')">&times;</button>
    `;
    container.appendChild(div);
  });
}

function deleteExistingOrderImage(index) {
  state.tempExistingImages.splice(index, 1);
  renderOrderFormImagesPreview();
}

function deleteTempOrderImage(id) {
  const index = state.tempSelectedFiles.findIndex(item => item.id === id);
  if (index !== -1) {
    URL.revokeObjectURL(state.tempSelectedFiles[index].previewUrl);
    state.tempSelectedFiles.splice(index, 1);
  }
  renderOrderFormImagesPreview();
}

function compressImage(file, maxWidth = 700, maxHeight = 700, quality = 0.5) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        if (window.storage) {
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', quality);
        } else {
          resolve(canvas.toDataURL('image/jpeg', quality));
        }
      };
    };
  });
}

function openLightbox(url) {
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  if (modal && img) {
    img.src = url;
    modal.classList.add('active');
  }
}

function closeLightbox() {
  const modal = document.getElementById('lightbox-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function copyTrackingLink(orderId) {
  if (!orderId) return;
  
  const url = `${window.location.origin}${window.location.pathname}?order=${orderId}`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => {
        showToast(`Đã sao chép link tra cứu đơn hàng ${orderId}!`);
      })
      .catch(err => {
        console.error('Failed to copy text using Clipboard API:', err);
        fallbackCopyText(url, orderId);
      });
  } else {
    fallbackCopyText(url, orderId);
  }
}

function fallbackCopyText(text, orderId) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast(`Đã sao chép link tra cứu đơn hàng ${orderId}!`);
    } else {
      alert(`Link tra cứu của bạn: ${text}`);
    }
  } catch (err) {
    console.error('Fallback copy text failed:', err);
    alert(`Link tra cứu của bạn: ${text}`);
  }
  
  document.body.removeChild(textArea);
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: var(--color-brand-gold);"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/></svg>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
