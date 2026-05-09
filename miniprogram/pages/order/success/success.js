const API = require('../../../utils/api.js');

Page({
  data: {
    orderId: null,
    orderNo: '',
    deliveryTime: '',
    address: null,
    items: [],
    totalAmount: '0.00',
    countdown: 5
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: parseInt(options.id) });
      this.loadOrderDetail(options.id);
    }
    this.startCountdown();
  },

  loadOrderDetail(orderId) {
    API.getOrderDetail(orderId).then(res => {
      const data = res.data;
      this.setData({
        orderNo: data.order_no,
        deliveryTime: data.delivery?.slot_name || '',
        address: data.address,
        items: data.items,
        totalAmount: data.pay_amount.toFixed(2)
      });
    }).catch(() => {});
  },

  startCountdown() {
    const timer = setInterval(() => {
      const current = this.data.countdown;
      if (current <= 1) {
        clearInterval(timer);
        this.goHome();
      } else {
        this.setData({ countdown: current - 1 });
      }
    }, 1000);
    this.countdownTimer = timer;
  },

  goHome() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    wx.switchTab({ url: '/pages/index/index' });
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }
});