const API = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    cartIds: '',
    address: null,
    slots: [],
    selectedSlot: null,
    items: [],
    totalAmount: '0.00',
    remark: '',
    deliveryDateDisplay: ''
  },

  onShow() {
    // 每次进入页面都重新加载数据
    this.loadAddress();
  },

  onLoad(options) {
    this.setData({ cartIds: options.cart_ids || '' });
    this.loadAddress();
    this.loadDeliverySlots();
    this.loadCartItems();
  },

  loadAddress() {
    API.getAddressList().then(res => {
      const address = res.data.find(a => a.is_default === 1) || res.data[0] || null;
      this.setData({ address });
    }).catch((err) => {
      if (err.code === 401) {
        wx.navigateTo({ url: '/pages/login/index' });
      }
    });
  },

  loadDeliverySlots() {
    API.getDeliverySlots().then(res => {
      const data = res.data;
      this.setData({
        slots: data.slots,
        deliveryDateDisplay: data.delivery_date_display,
        selectedSlot: data.slots[0]?.id
      });
    }).catch(() => {});
  },

  loadCartItems() {
    API.getCartList().then(res => {
      this.setData({
        items: res.data.items,
        totalAmount: res.data.total.toFixed(2)
      });
    }).catch(() => {});
  },

  selectAddress() {
    wx.navigateTo({ url: '/pages/address/list?mode=select' });
  },

  selectSlot(e) {
    this.setData({ selectedSlot: e.currentTarget.dataset.id });
  },

  inputRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  submitOrder() {
    if (!this.data.address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }

    if (!this.data.selectedSlot) {
      wx.showToast({ title: '请选择配送时间', icon: 'none' });
      return;
    }

    const data = {
      address_id: this.data.address.id,
      slot_id: this.data.selectedSlot,
      remark: this.data.remark
    };

    if (this.data.cartIds) {
      data.cart_ids = this.data.cartIds.split(',').map(id => parseInt(id));
    }

    console.log('[OrderConfirm] Submitting order with data:', data);

    wx.showLoading({ title: '提交中...' });
    API.createOrder(data).then((res) => {
      wx.hideLoading();
      console.log('[OrderConfirm] Order created successfully:', res.data);
      wx.showToast({ title: '下单成功', icon: 'success', duration: 2000 });
      setTimeout(() => {
        console.log('[OrderConfirm] Navigating to order list...');
        wx.switchTab({
          url: '/pages/order/list',
          success: () => {
            console.log('[OrderConfirm] switchTab success, refreshing order list');
            const pages = getCurrentPages();
            const orderList = pages.find(p => p.route.includes('order/list'));
            if (orderList && orderList.loadOrders) {
              orderList.loadOrders();
            }
          },
          fail: (err) => {
            console.log('[OrderConfirm] switchTab failed:', err);
          }
        });
      }, 1500);
    }).catch((err) => {
      wx.hideLoading();
      console.error('[OrderConfirm] Order create failed:', err);
      wx.showToast({ title: '创建订单失败', icon: 'none' });
    });
  }
});