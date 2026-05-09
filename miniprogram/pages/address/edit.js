const API = require('../../utils/api.js');

Page({
  data: {
    id: null,
    formData: {
      name: '',
      phone: '',
      community: '',
      building: '',
      room: '',
      is_default: false
    },
    communities: [],
    communityIndex: 0
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: parseInt(options.id) });
      wx.setNavigationBarTitle({ title: '编辑地址' });
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' });
    }
    this.loadCommunities();
  },

  loadCommunities() {
    API.getCommunityList().then(res => {
      this.setData({ communities: res.data });
      if (this.data.id) {
        this.loadAddress(this.data.id);
      }
    }).catch(() => {});
  },

  loadAddress(id) {
    API.getAddressDetail(id).then(res => {
      const community = res.data.community;
      const communities = this.data.communities;
      const communityIndex = community && communities.length > 0 ? communities.indexOf(community) : 0;
      this.setData({
        'formData': res.data,
        communityIndex: communityIndex >= 0 ? communityIndex : 0
      });
    }).catch(() => {});
  },

  bindName(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  bindPhone(e) {
    this.setData({ 'formData.phone': e.detail.value });
  },

  bindCommunityChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      communityIndex: index,
      'formData.community': this.data.communities[index]
    });
  },

  bindBuilding(e) {
    this.setData({ 'formData.building': e.detail.value });
  },

  bindRoom(e) {
    this.setData({ 'formData.room': e.detail.value });
  },

  bindDefault(e) {
    this.setData({ 'formData.is_default': e.detail.value });
  },

  saveAddress() {
    const { formData } = this.data;
    if (!formData.name || !formData.phone || !formData.community) {
      wx.showToast({ title: '请填写收货人、手机号和小区', icon: 'none' });
      return;
    }

    if (this.data.id) {
      API.updateAddress({ id: this.data.id, ...formData }).then(() => {
        wx.showToast({ title: '更新成功', icon: 'success' });
        const address = { id: this.data.id, ...formData };
        wx.setStorageSync('selectedAddress', address);
        wx.navigateBack();
      }).catch(() => {});
    } else {
      API.createAddress(formData).then((res) => {
        wx.showToast({ title: '创建成功', icon: 'success' });
        const address = { id: res.data.id, ...formData };
        wx.setStorageSync('selectedAddress', address);
        wx.navigateBack();
      }).catch(() => {});
    }
  }
});