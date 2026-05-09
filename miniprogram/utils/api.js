const App = getApp();

const API_BASE = 'https://dayan-garden-production.up.railway.app/api';

// 检查登录状态
function checkSession() {
  return new Promise((resolve, reject) => {
    wx.checkSession({
      success: () => {
        const token = wx.getStorageSync('token');
        if (token) {
          resolve(token);
        } else {
          reject('not login');
        }
      },
      fail: () => {
        reject('session expired');
      }
    });
  });
}

// 获取用户ID
function getUserId() {
  return wx.getStorageSync('userId') || null;
}

// 通用请求方法
function request(url, method = 'GET', data = {}, header = {}) {
  const token = wx.getStorageSync('token');
  const userId = getUserId();
  const defaultHeader = {
    'Content-Type': 'application/json'
  };
  if (token) {
    defaultHeader['Authorization'] = 'Bearer ' + token;
  }
  if (userId) {
    defaultHeader['X-User-ID'] = userId;
  }

  // 对于GET请求，将参数拼接到URL
  let fullUrl = API_BASE + url;
  if (method === 'GET' && data && Object.keys(data).length > 0) {
    const queryString = Object.keys(data).map(key => {
      const value = data[key];
      if (value !== null && value !== undefined && value !== '') {
        return encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
      return null;
    }).filter(v => v !== null).join('&');
    if (queryString) {
      fullUrl = fullUrl + (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  console.log('[API Request]', method, fullUrl, 'data:', data, 'userId:', userId);

  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '加载中...' });
    wx.request({
      url: fullUrl,
      method,
      data: method !== 'GET' ? data : undefined,
      header: { ...defaultHeader, ...header },
      success: (res) => {
        wx.hideLoading();
        console.log('[API Response]', res.statusCode, res.data);
        if (res.data.code === 200) {
          resolve(res.data);
        } else if (res.data.code === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userId');
          wx.showToast({ title: res.data.message || '请先登录', icon: 'none' });
          reject(res.data);
        } else if (res.data.code === 403) {
          wx.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(res.data);
        } else {
          wx.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(res.data);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.log('[API Error]', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      }
    });
  });
}

// API 方法
module.exports = {
  // 认证
  wechatLogin: (code) => request('/auth/wechat/login', 'POST', { code }),
  merchantLogin: (username, password) => request('/auth/merchant/login', 'POST', { username, password }),
  riderLogin: (username, password) => request('/auth/rider/login', 'POST', { username, password }),
  verifyToken: () => request('/auth/verify'),
  getProfile: () => request('/auth/profile'),

  // 商品
  getCategories: () => request('/product/categories'),
  getProducts: (params) => request('/product/list', 'GET', params),
  getProductDetail: (id) => request('/product/detail/' + id),
  getRecommend: () => request('/product/recommend'),
  getBanners: () => request('/product/banners'),
  searchProducts: (keyword) => request('/product/search?keyword=' + keyword),

  // 购物车
  getCartList: () => request('/cart/list'),
  addToCart: (productId, quantity) => request('/cart/add', 'POST', { product_id: productId, quantity }),
  updateCart: (cartId, quantity) => request('/cart/update', 'POST', { cart_id: cartId, quantity }),
  removeCart: (cartIds) => request('/cart/remove', 'POST', { cart_ids: cartIds }),
  getCartCount: () => request('/cart/count'),

  // 地址
  getAddressList: () => request('/address/list'),
  getAddressDetail: (id) => request('/address/detail/' + id),
  createAddress: (data) => request('/address/create', 'POST', data),
  updateAddress: (data) => request('/address/update', 'POST', data),
  deleteAddress: (id) => request('/address/delete', 'POST', { id }),
  setDefaultAddress: (id) => request('/address/set-default', 'POST', { id }),
  getCommunityList: () => request('/address/communities'),

  // 订单
  createOrder: (data) => request('/order/create', 'POST', data),
  getOrderList: (params) => request('/order/list', 'GET', params),
  getOrderDetail: (id) => request('/order/detail/' + id),
  payOrder: (orderId) => request('/order/pay', 'POST', { order_id: orderId }),
  cancelOrder: (orderId, reason) => request('/order/cancel', 'POST', { order_id: orderId, reason }),
  confirmOrder: (orderId) => request('/order/confirm', 'POST', { order_id: orderId }),
  deleteOrder: (orderId) => request('/order/delete', 'POST', { order_id: orderId }),
  refundOrder: (orderId, reason) => request('/order/refund', 'POST', { order_id: orderId, reason }),

  // 配送
  getDeliverySlots: () => request('/delivery/slots'),
  getDeliveryTrack: (orderId) => request('/delivery/track/' + orderId),
  getDeliveryCutoff: () => request('/delivery/is_cutoff'),
  getRiderOrders: () => request('/delivery/rider/orders'),

  // 骑手配送
  acceptDelivery: (id) => request('/delivery/rider/accept', 'POST', { delivery_id: id }),
  pickupDelivery: (id) => request('/delivery/rider/pickup', 'POST', { delivery_id: id }),
  deliverDelivery: (id) => request('/delivery/rider/deliver', 'POST', { delivery_id: id }),
  arriveDelivery: (id) => request('/delivery/rider/arrive', 'POST', { delivery_id: id }),
  completeDelivery: (id) => request('/delivery/rider/complete', 'POST', { delivery_id: id }),

  // 商家后台
  adminProductList: (params) => request('/admin/product/list', 'GET', params),
  adminProductCreate: (data) => request('/admin/product/create', 'POST', data),
  adminProductUpdate: (data) => request('/admin/product/update', 'POST', data),
  adminProductDelete: (id) => request('/admin/product/delete', 'POST', { id }),
  adminOrderList: (params) => request('/admin/order/list', 'GET', params),
  adminOrderDetail: (id) => request('/admin/order/detail/' + id),
  adminOrderAccept: (orderId) => request('/admin/order/accept', 'POST', { order_id: orderId }),
  assignRider: (orderId, riderId) => request('/delivery/assign', 'POST', { order_id: orderId, rider_id: riderId }),
  getRiderList: () => request('/admin/rider/list'),
  getDeliverySlotsAdmin: () => request('/admin/delivery/slots'),
  getDashboard: () => request('/admin/dashboard'),
  adminCategoryList: () => request('/admin/category/list'),
  adminBannerList: () => request('/admin/banner/list')
};