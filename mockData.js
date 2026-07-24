// Default data for Shoe Spa Order Management Webapp

const DEFAULT_SERVICES = [
  // VỆ SINH GIÀY
  { id: 'vs-giay', name: 'Vệ sinh giày', category: 'Vệ sinh giày', defaultPrice: 80000, priceRange: '60.000 - 100.000đ' },
  { id: 'vs-tre-em', name: 'Vệ sinh giày trẻ em', category: 'Vệ sinh giày', defaultPrice: 40000, priceRange: '40.000đ' },
  { id: 'vs-da-boot', name: 'Vệ sinh giày da, boot, da lộn', category: 'Vệ sinh giày', defaultPrice: 105000, priceRange: '90.000 - 120.000đ' },
  { id: 'vs-dep', name: 'Vệ sinh dép', category: 'Vệ sinh giày', defaultPrice: 45000, priceRange: '45.000đ' },

  // THAY ĐẾ GIÀY
  { id: 'thay-de-the-thao', name: 'Thay đế giày thể thao', category: 'Thay đế giày', defaultPrice: 400000, priceRange: '350.000 - 450.000đ' },

  // TẨY Ố
  { id: 'tay-o-than', name: 'Tẩy ố, mốc thân giày', category: 'Tẩy ố', defaultPrice: 120000, priceRange: '120.000đ' },
  { id: 'tay-o-de', name: 'Tẩy ố đế', category: 'Tẩy ố', defaultPrice: 150000, priceRange: '150.000đ' },

  // REPAINT
  { id: 'repaint-de', name: 'Repaint đế', category: 'Repaint', defaultPrice: 200000, priceRange: '200.000đ' },
  { id: 'repaint-than', name: 'Repaint thân', category: 'Repaint', defaultPrice: 300000, priceRange: '200.000 - 400.000đ' },

  // DÁN ĐẾ GIÀY
  { id: 'dan-bong-keo', name: 'Dán bong keo', category: 'Dán đế giày', defaultPrice: 140000, priceRange: '30.000 - 250.000đ' },
  { id: 'dan-de-the-thao', name: 'Dán đế giày thể thao', category: 'Dán đế giày', defaultPrice: 310000, priceRange: '270.000 - 350.000đ' },
  { id: 'dan-de-cao-su', name: 'Dán đế cao su', category: 'Dán đế giày', defaultPrice: 300000, priceRange: '200.000 - 400.000đ' }
];

const DEFAULT_USERS = [
  { id: 'u-admin', email: 'admin@phuibui.vn', password: 'admin', name: 'Nguyễn Văn Admin', role: 'admin' },
  { id: 'u-staff-1', email: 'nhanvien@phuibui.vn', password: 'staff', name: 'Trần Văn Nhân Viên', role: 'staff' },
  { id: 'u-staff-2', email: 'hoang.nv@phuibui.vn', password: 'staff', name: 'Hoàng Nhân Viên', role: 'staff' }
];

const DEFAULT_STORE_INFO = {
  name: 'SPA GIÀY',
  subtitle: 'SHOE SPA & REPAIR',
  hotline: '0906 22 7512',
  address: 'N07C - LK19, VẠN PHÚC, HÀ ĐÔNG, HÀ NỘI',
  logoUrl: '',
  receiptNote: 'Cảm ơn quý khách đã tin tưởng dịch vụ của chúng tôi!\nQuý khách vui lòng mang hóa đơn này khi nhận lại giày.'
};

if (typeof window !== 'undefined') {
  window.DEFAULT_SERVICES = DEFAULT_SERVICES;
  window.DEFAULT_USERS = DEFAULT_USERS;
  window.BRAND_INFO = DEFAULT_STORE_INFO;
  window.DEFAULT_STORE_INFO = DEFAULT_STORE_INFO;
  window.INITIAL_ORDERS = INITIAL_ORDERS;
}
