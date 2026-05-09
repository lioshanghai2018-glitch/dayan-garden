const app = getApp();

Page({
  data: {
    userInfo: null,
    isLogin: false
  },

  onShow() {
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId');
    this.setData({
      isLogin: !!token,
      userInfo: app.globalData.userInfo || { id: userId }
    });
  },

  goToOrders() {
    console.log('[User] goToOrders clicked, token:', wx.getStorageSync('token'), 'userId:', wx.getStorageSync('userId'));
    const token = wx.getStorageSync('token');
    if (!token) {
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
    wx.switchTab({ url: '/pages/order/list' });
  },

  goToAddresses() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后管理地址',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/index' });
          }
        }
      });
      return;
    }
    wx.navigateTo({ url: '/pages/address/list' });
  },

  callService() {
    wx.showToast({ title: '客服电话: 400-123-4567', icon: 'none' });
  },

  aboutUs() {
    wx.showModal({
      title: '关于我们',
      content: '大研菜园 - 新鲜蔬菜送到家\nVersion 1.0.0',
      showCancel: false
    });
  },

  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          this.setData({ isLogin: false, userInfo: null });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  }
});