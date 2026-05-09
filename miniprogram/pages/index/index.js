const API = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    banners: [],
    categories: [],
    products: [],
    categoryId: null,
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    isCutoff: false
  },

  onLoad() {
    this.loadBanners();
    this.loadCategories();
    this.loadProducts();
    this.checkCutoff();
  },

  onShow() {
    this.updateCartBadge();
  },

  loadBanners() {
    API.getBanners().then(res => {
      this.setData({ banners: res.data });
    }).catch(() => {});
  },

  loadCategories() {
    API.getCategories().then(res => {
      this.setData({ categories: res.data });
    }).catch(() => {});
  },

  loadProducts(isLoadMore = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    const params = { page: this.data.page, page_size: this.data.pageSize };
    if (this.data.categoryId) {
      params.category_id = this.data.categoryId;
    }

    API.getProducts(params).then(res => {
      let products = res.data.list;
      if (isLoadMore) {
        products = [...this.data.products, ...products];
      }
      this.setData({
        products,
        hasMore: res.data.page < res.data.pages,
        loading: false
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({ categoryId, page: 1, products: [] });
    this.loadProducts();
  },

  goToSearch() {
    wx.navigateTo({ url: '/pages/search/index' });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/product/detail?id=' + id });
  },

  addToCart(e) {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再添加商品到购物车',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/index' });
          }
        }
      });
      return;
    }

    const productId = e.currentTarget.dataset.id;
    API.addToCart(productId, 1).then(() => {
      wx.showToast({ title: '已添加到购物车', icon: 'success' });
      this.updateCartBadge();
    }).catch(() => {});
  },

  updateCartBadge() {
    API.getCartCount().then(res => {
      if (res.data.count > 0) {
        wx.setTabBarBadge({ index: 2, text: String(res.data.count) });
      } else {
        wx.removeTabBarBadge({ index: 2 });
      }
    }).catch(() => {});
  },

  checkCutoff() {
    API.getDeliveryCutoff().then(res => {
      this.setData({ isCutoff: res.data.cutoff });
    }).catch(() => {});
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 });
      this.loadProducts(true);
    }
  }
});