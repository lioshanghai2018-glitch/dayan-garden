const API = require('../../utils/api.js');

Page({
  data: {
    orderId: null,
    status: 0,
    statusText: '',
    statusColor: '',
    statusHint: '',
    orderNo: '',
    createdAt: '',
    payTime: '',
    remark: '',
    address: null,
    deliveryTime: '',
    items: [],
    totalAmount: '0.00',
    showActions: true,
    // 售后相关
    showAftersaleModal: false,
    aftersaleType: 1,
    aftersaleReason: '',
    aftersaleImages: []
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: parseInt(options.id) });
      this.loadOrderDetail(options.id);
    }
  },

  loadOrderDetail(orderId) {
    API.getOrderDetail(orderId).then(res => {
      const data = res.data;
      this.setData({
        status: data.status,
        statusText: data.status_text,
        statusColor: this.getStatusColor(data.status),
        statusHint: this.getStatusHint(data.status),
        orderNo: data.order_no,
        createdAt: data.created_at,
        payTime: data.pay_time || '',
        remark: data.remark || '',
        address: data.address,
        deliveryTime: data.delivery?.slot_name || '',
        items: data.items,
        totalAmount: data.pay_amount.toFixed(2)
      });
    }).catch(() => {});
  },

  getStatusColor(status) {
    const colors = {
      0: '#FF6B00',
      1: '#FF6B00',
      2: '#FF6B00',
      3: '#FAAD14',
      4: '#2E7D32',
      5: '#2E7D32',
      6: '#999999',
      7: '#999999',
      8: '#FAAD14',
      9: '#999999'
    };
    return colors[status] || '#999999';
  },

  getStatusHint(status) {
    const hints = {
      0: '请在30分钟内完成支付',
      1: '商家正在处理您的订单',
      2: '商家已接单，等待备货',
      3: '骑手正在取货',
      4: '骑手正在为您配送',
      5: '骑手已到达，即将送达',
      6: '感谢您的订购',
      7: '订单已取消',
      8: '售后申请处理中',
      9: '已退款'
    };
    return hints[status] || '';
  },

  payOrder() {
    wx.showModal({
      title: '确认支付',
      content: '确认支付 ¥' + this.data.totalAmount + '？',
      success: (res) => {
        if (res.confirm) {
          API.payOrder(this.data.orderId).then(() => {
            wx.showToast({ title: '支付成功', icon: 'success' });
            this.loadOrderDetail(this.data.orderId);
          }).catch(() => {});
        }
      }
    });
  },

  cancelOrder() {
    wx.showModal({
      title: '确认取消',
      content: '确定取消该订单？',
      success: (res) => {
        if (res.confirm) {
          API.cancelOrder(this.data.orderId, '用户取消').then(() => {
            wx.showToast({ title: '订单已取消', icon: 'success' });
            this.loadOrderDetail(this.data.orderId);
          }).catch(() => {});
        }
      }
    });
  },

  reOrder() {
    const promises = this.data.items.map(item => {
      return API.addToCart(item.product_id, item.quantity);
    });
    Promise.all(promises).then(() => {
      wx.showToast({ title: '已加入购物车', icon: 'success' });
      wx.switchTab({ url: '/pages/cart/index' });
    }).catch(() => {
      wx.showToast({ title: '加入购物车失败', icon: 'none' });
    });
  },

  callRider() {
    const rider = this.data.delivery?.rider_phone;
    if (rider) {
      wx.makePhoneCall({ phoneNumber: rider });
    } else {
      wx.showToast({ title: '暂无可用骑手电话', icon: 'none' });
    }
  },

  // ========== 售后相关 ==========

  showAftersaleModal() {
    this.setData({
      showAftersaleModal: true,
      aftersaleType: 1,
      aftersaleReason: '',
      aftersaleImages: []
    });
  },

  hideAftersaleModal() {
    this.setData({ showAftersaleModal: false });
  },

  stopProp(e) {
    e.stopPropagation();
  },

  selectAftersaleType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ aftersaleType: type });
  },

  inputReason(e) {
    this.setData({ aftersaleReason: e.detail.value });
  },

  chooseAftersaleImage() {
    if (this.data.aftersaleImages.length >= 3) {
      wx.showToast({ title: '最多上传3张图片', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: 3 - this.data.aftersaleImages.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        // 实际上传图片到服务器
        const uploadPromises = tempFilePaths.map(path => {
          return this.uploadImage(path);
        });
        Promise.all(uploadPromises).then(uploadedUrls => {
          this.setData({
            aftersaleImages: [...this.data.aftersaleImages, ...uploadedUrls]
          });
        }).catch(() => {
          // 如果上传失败，使用本地路径
          this.setData({
            aftersaleImages: [...this.data.aftersaleImages, ...tempFilePaths]
          });
        });
      }
    });
  },

  uploadImage(filePath) {
    const uploadUrl = 'https://dayan-garden-production.up.railway.app/api/upload/image';
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: uploadUrl,
        filePath: filePath,
        name: 'image',
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 200) {
              resolve(data.data.url);
            } else {
              reject(new Error(data.message));
            }
          } catch (e) {
            reject(e);
          }
        },
        fail: reject
      });
    });
  },

  removeAftersaleImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.aftersaleImages];
    images.splice(index, 1);
    this.setData({ aftersaleImages: images });
  },

  submitAftersale() {
    const { aftersaleType, aftersaleReason, aftersaleImages } = this.data;

    if (!aftersaleReason.trim()) {
      wx.showToast({ title: '请输入退款原因', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认提交',
      content: aftersaleType === 1 ? '确定提交退货退款申请吗？' : '确定提交仅退款申请吗？',
      success: (res) => {
        if (res.confirm) {
          API.aftersaleApply(
            this.data.orderId,
            aftersaleType,
            aftersaleReason,
            aftersaleImages
          ).then(() => {
            wx.showToast({ title: '申请已提交', icon: 'success' });
            this.hideAftersaleModal();
            this.loadOrderDetail(this.data.orderId);
          }).catch((err) => {
            wx.showToast({ title: err.message || '提交失败', icon: 'none' });
          });
        }
      }
    });
  }
});