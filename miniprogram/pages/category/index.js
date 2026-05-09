const API = require('../../utils/api.js');

Page({
  data: {
    categories: [],
    activeCategory: null,
    products: []
  },

  onLoad() {
    this.loadCategories();
  },

  loadCategories() {
    API.getCategories().then(res => {
      const categories = res.data;
      this.setData({ categories });
      if (categories.length > 0) {
        this.selectCategory({ currentTarget: { dataset: { id: categories[0].id } } });
      }
    }).catch(() => {});
  },

  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({ activeCategory: categoryId, products: [] });
    this.loadProducts(categoryId);
  },

  loadProducts(categoryId) {
    API.getProducts({ category_id: categoryId, page: 1, page_size: 50 }).then(res => {
      this.setData({ products: res.data.list });
    }).catch(() => {});
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/product/detail?id=' + id });
  },

  addToCart(e) {
    const productId = e.currentTarget.dataset.id;
    API.addToCart(productId, 1).then(() => {
      wx.showToast({ title: '已添加到购物车', icon: 'success' });
    }).catch(() => {});
  }
});