const API = require('../../utils/api.js');

Page({
  data: {
    keyword: '',
    products: [],
    searched: false
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  search() {
    const keyword = this.data.keyword.trim();
    if (!keyword) {
      wx.showToast({ title: '请输入搜索词', icon: 'none' });
      return;
    }

    API.searchProducts(keyword).then(res => {
      this.setData({ products: res.data.list, searched: true });
    }).catch(() => {
      this.setData({ products: [], searched: true });
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/product/detail?id=' + id });
  }
});