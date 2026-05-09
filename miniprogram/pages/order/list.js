const API = require('../../utils/api.js');
const { getOrderStatusText, getOrderStatusColor } = require('../../utils/util.js');

console.log('[OrderList] list.js loaded');

Page({
  data: {
    status: null,
    orders: [],
    page: 1,
    loading: false,
    hasMore: true
  },

  onLoad(options) {
    console.log('[OrderList] onLoad called with options:', options);
    if (options.status) {
      this.setData({ status: parseInt(options.status) });
    }
    this.loadOrders();
  },

  onShow() {
    console.log('[OrderList] onShow called');
    const token = wx.getStorageSync('token');
    console.log('[OrderList] token:', token);
    if (!token) {
      console.log('[OrderList] No token, showing login prompt');
      wx.showModal({
        title: '提示',
        content: '请先登录后查看订单',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/index' });
          }
        }
      });
      return;
    }
    this.setData({ page: 1, orders: [] });
    console.log('[OrderList] Calling loadOrders');
    this.loadOrders();
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ status: status === '' ? null : parseInt(status), page: 1, orders: [] });
    this.loadOrders();
  },

  loadOrders(isLoadMore = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const params = { page: this.data.page, page_size: 10 };
    if (this.data.status !== null) {
      params.status = this.data.status;
    }

    console.log('[OrderList] Calling getOrderList with params:', params);

    API.getOrderList(params).then(res => {
      console.log('[OrderList] getOrderList response:', res);
      let orders = res.data.list.map(order => ({
        ...order,
        statusText: getOrderStatusText(order.status),
        statusColor: getOrderStatusColor(order.status)
      }));

      if (isLoadMore) {
        orders = [...this.data.orders, ...orders];
      }

      console.log('[OrderList] Setting orders:', orders.length);
      this.setData({
        orders,
        hasMore: res.data.list.length === 10,
        loading: false
      });
    }).catch((err) => {
      console.log('[OrderList] getOrderList error:', err);
      this.setData({ loading: false });
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/order/detail?id=' + id });
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrders(true);
    }
  }
});