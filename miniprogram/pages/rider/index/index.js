const API = require('../../../utils/api.js');

Page({
  data: {
    riderInfo: null,
    isOnline: true,
    statusText: '接单中',
    todayCount: 0,
    orderList: []
  },

  onLoad() {
    this.loadRiderInfo();
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  loadRiderInfo() {
    API.verifyToken().then(res => {
      this.setData({ riderInfo: res.data });
    }).catch(() => {});
  },

  loadOrders() {
    API.getRiderOrders().then(res => {
      this.setData({
        orderList: res.data,
        todayCount: res.data.filter(o => o.status === 5).length
      });
    }).catch(() => {});
  },

  toggleStatus(e) {
    this.setData({ isOnline: e.detail.value, statusText: e.detail.value ? '接单中' : '已下线' });
  },

  accept(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认接单',
      content: '确认接此配送任务？',
      success: (res) => {
        if (res.confirm) {
          API.acceptDelivery(id).then(() => {
            wx.showToast({ title: '接单成功', icon: 'success' });
            this.loadOrders();
          }).catch(() => {});
        }
      }
    });
  },

  pickup(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认取货',
      content: '确认已从商家取到货物？',
      success: (res) => {
        if (res.confirm) {
          API.pickupDelivery(id).then(() => {
            wx.showToast({ title: '取货成功', icon: 'success' });
            this.loadOrders();
          }).catch(() => {});
        }
      }
    });
  },

  deliver(e) {
    const id = e.currentTarget.dataset.id;
    API.deliverDelivery(id).then(() => {
      wx.showToast({ title: '开始配送', icon: 'success' });
      this.loadOrders();
    }).catch(() => {});
  },

  arrive(e) {
    const id = e.currentTarget.dataset.id;
    API.arriveDelivery(id).then(() => {
      wx.showToast({ title: '已到达', icon: 'success' });
      this.loadOrders();
    }).catch(() => {});
  },

  complete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认送达',
      content: '确认已将货物送达客户手中？',
      success: (res) => {
        if (res.confirm) {
          API.completeDelivery(id).then(() => {
            wx.showToast({ title: '配送完成', icon: 'success' });
            this.loadOrders();
          }).catch(() => {});
        }
      }
    });
  }
});