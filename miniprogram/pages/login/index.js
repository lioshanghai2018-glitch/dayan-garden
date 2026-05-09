const API = require('../../utils/api.js');
const app = getApp();

Page({
  onLoad() {
    // 如果已经登录，直接跳转
    const token = wx.getStorageSync('token');
    if (token) {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  autoLogin() {
    wx.showLoading({ title: '登录中...' });

    // 模拟微信登录获取code
    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用微信登录接口
          API.wechatLogin(res.code).then(result => {
            wx.hideLoading();
            app.loginSuccess(result.data.token, result.data.user);
            wx.switchTab({ url: '/pages/index/index' });
          }).catch((err) => {
            wx.hideLoading();
            console.error('登录失败', err);
            wx.showToast({ title: '登录失败', icon: 'none' });
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '微信登录失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      }
    });
  }
});