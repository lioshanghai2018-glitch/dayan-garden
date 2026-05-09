App({
  globalData: {
    userInfo: null,
    token: null,
    isLogin: false
  },

  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId');
    if (token && userId) {
      this.globalData.token = token;
      this.globalData.isLogin = true;
    }

    // 获取购物车数量
    this.updateCartCount();
  },

  updateCartCount() {
    const API = require('./utils/api.js');
    API.getCartCount().then(res => {
      if (res.data.count > 0) {
        wx.setTabBarBadge({
          index: 2,
          text: String(res.data.count)
        });
      } else {
        wx.removeTabBarBadge({ index: 2 });
      }
    }).catch(() => {});
  },

  loginSuccess(token, user) {
    this.globalData.token = token;
    this.globalData.isLogin = true;
    this.globalData.userInfo = user;
    wx.setStorageSync('token', token);
    wx.setStorageSync('userId', user.id);
    this.updateCartCount();
  },

  logout() {
    this.globalData.token = null;
    this.globalData.isLogin = false;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userId');
    wx.removeTabBarBadge({ index: 2 });
  }
});