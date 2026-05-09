const API = require('../../utils/api.js');

Page({
  data: {
    orderId: null,
    status: 0,
    statusText: '',
    statusColor: '',
    statusHint: '',
    orderNo: '',
    createdAt: '',
    payTime: '',
    remark: '',
    address: null,
    deliveryTime: '',
    items: [],
    totalAmount: '0.00',
    showActions: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: parseInt(options.id) });
      this.loadOrderDetail(options.id);
    }
  },

  loadOrderDetail(orderId) {
    API.getOrderDetail(orderId).then(res => {
      const data = res.data;
      this.setData({
        status: data.status,
        statusText: data.status_text,
        statusColor: this.getStatusColor(data.status),
        statusHint: this.getStatusHint(data.status),
        orderNo: data.order_no,
        createdAt: data.created_at,
        payTime: data.pay_time || '',
        remark: data.remark || '',
        address: data.address,
        deliveryTime: data.delivery?.slot_name || '',
        items: data.items,
        totalAmount: data.pay_amount.toFixed(2)
      });
    }).catch(() => {});
  },

  getStatusColor(status) {
    const colors = {
      0: '#FF6B00',
      1: '#FF6B00',
      2: '#FF6B00',
      3: '#FAAD14',
      4: '#2E7D32',
      5: '#2E7D32',
      6: '#999999',
      7: '#999999',
      8: '#FAAD14',
      9: '#999999'
    };
    return colors[status] || '#999999';
  },

  getStatusHint(status) {
    const hints = {
      0: '请在30分钟内完成支付',
      1: '商家正在处理您的订单',
      2: '商家已接单，等待备货',
      3: '骑手正在取货',
      4: '骑手正在为您配送',
      5: '骑手已到达，即将送达',
      6: '感谢您的订购',
      7: '订单已取消',
      8: '退款申请处理中',
      9: '已退款'
    };
    return hints[status] || '';
  },

  payOrder() {
    wx.showModal({
      title: '确认支付',
      content: '确认支付 ¥' + this.data.totalAmount + '？',
      success: (res) => {
        if (res.confirm) {
          API.payOrder(this.data.orderId).then(() => {
            wx.showToast({ title: '支付成功', icon: 'success' });
            this.loadOrderDetail(this.data.orderId);
          }).catch(() => {});
        }
      }
    });
  },

  cancelOrder() {
    wx.showModal({
      title: '确认取消',
      content: '确定取消该订单？',
      success: (res) => {
        if (res.confirm) {
          API.cancelOrder(this.data.orderId, '用户取消').then(() => {
            wx.showToast({ title: '订单已取消', icon: 'success' });
            this.loadOrderDetail(this.data.orderId);
          }).catch(() => {});
        }
      }
    });
  },

  reOrder() {
    // 将订单商品重新加入购物车
    const promises = this.data.items.map(item => {
      return API.addToCart(item.product_id, item.quantity);
    });
    Promise.all(promises).then(() => {
      wx.showToast({ title: '已加入购物车', icon: 'success' });
      wx.switchTab({ url: '/pages/cart/index' });
    }).catch(() => {
      wx.showToast({ title: '加入购物车失败', icon: 'none' });
    });
  },

  callRider() {
    const rider = this.data.delivery?.rider_phone;
    if (rider) {
      wx.makePhoneCall({ phoneNumber: rider });
    } else {
      wx.showToast({ title: '暂无可用骑手电话', icon: 'none' });
    }
  },

  applyRefund() {
    wx.showModal({
      title: '确认申请退款',
      content: '确定申请退款吗？',
      success: (res) => {
        if (res.confirm) {
          API.refundOrder(this.data.orderId, '用户申请退款').then(() => {
            wx.showToast({ title: '退款申请已提交', icon: 'success' });
            this.loadOrderDetail(this.data.orderId);
          }).catch(() => {});
        }
      }
    });
  }
});