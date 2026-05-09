const formatNumber = n => {
  n = n.toString();
  return n[1] ? n : '0' + n;
};

const formatTime = date => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return [year, month, day].map(formatNumber).join('-') + ' ' + [hour, minute, second].map(formatNumber).join(':');
};

const formatPrice = price => {
  if (!price && price !== 0) return '0.00';
  return parseFloat(price).toFixed(2);
};

const getOrderStatusText = status => {
  const statusMap = {
    0: '待支付',
    1: '待接单',
    2: '已接单',
    3: '待取货',
    4: '配送中',
    5: '已到达',
    6: '已完成',
    7: '已取消',
    8: '退款中',
    9: '已退款'
  };
  return statusMap[status] || '未知';
};

const getOrderStatusColor = status => {
  const colorMap = {
    0: '#FAAD14',
    1: '#1890FF',
    2: '#1890FF',
    3: '#52C41A',
    4: '#2E7D32',
    5: '#2E7D32',
    6: '#999999',
    7: '#F5222D',
    8: '#FAAD14',
    9: '#999999'
  };
  return colorMap[status] || '#999999';
};

module.exports = {
  formatTime,
  formatPrice,
  getOrderStatusText,
  getOrderStatusColor
};