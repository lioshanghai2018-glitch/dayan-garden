const API = require('../../utils/api.js');

Page({
  data: {
    items: [],
    selectedIds: [],
    totalPrice: '0.00',
    isAllSelected: false
  },

  onShow() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用购物车',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/index' });
          }
        }
      });
      return;
    }
    this.loadCart();
  },

  loadCart() {
    API.getCartList().then(res => {
      this.setData({
        items: res.data.items,
        totalPrice: res.data.total.toFixed(2)
      });
      this.updateSelected();
    }).catch(() => {});
  },

  toggleItem(e) {
    const id = e.currentTarget.dataset.id;
    const selectedIds = [...this.data.selectedIds];
    const index = selectedIds.indexOf(id);
    if (index > -1) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(id);
    }
    this.setData({ selectedIds });
    this.calculateTotal();
  },

  toggleAll() {
    if (this.data.isAllSelected) {
      this.setData({ selectedIds: [], isAllSelected: false });
    } else {
      this.setData({
        selectedIds: this.data.items.map(item => item.id),
        isAllSelected: true
      });
    }
    this.calculateTotal();
  },

  increaseQty(e) {
    const { id, qty, stock } = e.currentTarget.dataset;
    if (qty >= stock) {
      wx.showToast({ title: '库存不足', icon: 'none' });
      return;
    }
    API.updateCart(id, qty + 1).then(() => {
      this.loadCart();
    }).catch(() => {});
  },

  decreaseQty(e) {
    const { id, qty } = e.currentTarget.dataset;
    if (qty <= 1) {
      this.deleteItem({ currentTarget: { dataset: { id } } });
      return;
    }
    API.updateCart(id, qty - 1).then(() => {
      this.loadCart();
    }).catch(() => {});
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要从购物车移除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          API.removeCart([id]).then(() => {
            this.loadCart();
          }).catch(() => {});
        }
      }
    });
  },

  calculateTotal() {
    let total = 0;
    this.data.items.forEach(item => {
      if (this.data.selectedIds.includes(item.id)) {
        total += item.price * item.quantity;
      }
    });
    this.setData({ totalPrice: total.toFixed(2) });
  },

  updateSelected() {
    const allIds = this.data.items.map(item => item.id);
    const isAllSelected = allIds.length > 0 && allIds.every(id => this.data.selectedIds.includes(id));
    this.setData({ isAllSelected });
  },

  checkout() {
    if (this.data.selectedIds.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    const cartIds = this.data.selectedIds.join(',');
    wx.navigateTo({ url: `/pages/order/confirm?cart_ids=${cartIds}` });
  },

  goShopping() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});