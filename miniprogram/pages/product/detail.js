const API = require('../../utils/api.js');

Page({
  data: {
    product: {},
    showQuantityModal: false,
    quantity: 1,
    buyType: 'cart'
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadProduct(id);
    }
  },

  loadProduct(id) {
    API.getProductDetail(id).then(res => {
      this.setData({ product: res.data });
      wx.setNavigationBarTitle({ title: res.data.name });
    }).catch(() => {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      wx.navigateBack();
    });
  },

  addToCart() {
    this.setData({ showQuantityModal: true, buyType: 'cart', quantity: 1 });
  },

  buyNow() {
    this.setData({ showQuantityModal: true, buyType: 'buy', quantity: 1 });
  },

  closeModal() {
    this.setData({ showQuantityModal: false });
  },

  stopProp() {},

  decreaseQty() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  increaseQty() {
    if (this.data.quantity < this.data.product.stock) {
      this.setData({ quantity: this.data.quantity + 1 });
    } else {
      wx.showToast({ title: '库存不足', icon: 'none' });
    }
  },

  confirmAdd() {
    const { product, quantity, buyType } = this.data;
    API.addToCart(product.id, quantity).then(() => {
      this.setData({ showQuantityModal: false });
      wx.showToast({ title: '已添加到购物车', icon: 'success' });
      if (buyType === 'buy') {
        wx.switchTab({ url: '/pages/cart/index' });
      }
    }).catch(() => {});
  },

  goToCart() {
    wx.switchTab({ url: '/pages/cart/index' });
  }
});