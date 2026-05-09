const API = require('../../utils/api.js');

Page({
  data: {
    mode: 'manage',
    addresses: [],
    selectedId: null,
    loading: true,
    hasError: false
  },

  onLoad(options) {
    if (options.mode === 'select') {
      this.setData({ mode: 'select' });
      wx.setNavigationBarTitle({ title: '选择地址' });
    }
    this.loadAddresses();
  },

  loadAddresses() {
    this.setData({ loading: true, hasError: false });

    // Timeout fallback - 10秒后强制结束loading
    const timeoutId = setTimeout(() => {
      if (this.data.loading) {
        this.setData({ loading: false, hasError: true });
      }
    }, 10000);

    API.getAddressList().then(res => {
      clearTimeout(timeoutId);
      this.setData({ addresses: res.data || [], loading: false, hasError: false });
    }).catch(() => {
      clearTimeout(timeoutId);
      this.setData({ loading: false, hasError: true });
    });
  },

  onShow() {
    this.loadAddresses();
  },

  selectAddress(e) {
    if (this.data.mode === 'select') {
      const id = e.currentTarget.dataset.id;
      const address = this.data.addresses.find(a => a.id === id);
      if (address) {
        wx.setStorageSync('selectedAddress', address);
        wx.navigateBack();
      }
    }
  },

  addAddress() {
    wx.navigateTo({ url: '/pages/address/edit' });
  },

  editAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/address/edit?id=' + id });
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该地址吗？',
      success: (res) => {
        if (res.confirm) {
          API.deleteAddress(id).then(() => {
            this.loadAddresses();
          }).catch(() => {});
        }
      }
    });
  }
});