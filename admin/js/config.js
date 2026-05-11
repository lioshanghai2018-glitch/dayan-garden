// API配置
const API_BASE = 'https://dayan-garden-production.up.railway.app/api';

// 当前登录用户
let currentUser = null;
let authToken = null;

// 从localStorage恢复登录状态
function restoreSession() {
  const token = localStorage.getItem('admin_token');
  const user = localStorage.getItem('admin_user');
  if (token && user) {
    authToken = token;
    currentUser = JSON.parse(user);
    return true;
  }
  return false;
}

// 保存session
function saveSession(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('admin_token', token);
  localStorage.setItem('admin_user', JSON.stringify(user));
}

// 清除session
function clearSession() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

// 获取请求头
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken;
  }
  if (currentUser) {
    headers['X-User-ID'] = currentUser.id;
  }
  return headers;
}

// API请求
async function request(url, method = 'GET', data = null) {
  const options = {
    method,
    headers: getHeaders()
  };

  // 如果是FormData，不设置Content-Type（让浏览器自动处理）
  if (data instanceof FormData) {
    delete options.headers['Content-Type'];
    options.body = data;
  } else if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  } else if (data) {
    url += '?' + new URLSearchParams(data).toString();
  }

  try {
    const res = await fetch(API_BASE + url, options);
    const json = await res.json();

    if (json.code === 401) {
      clearSession();
      showLoginPage();
      throw new Error(json.message);
    }

    return json;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

// 显示登录页
function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('adminPage').classList.add('hidden');
}

// 显示管理后台
function showAdminPage() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('adminPage').classList.remove('hidden');
}

// 页面切换
function switchPage(pageName) {
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  // 显示目标页面
  document.getElementById('page-' + pageName).classList.remove('hidden');

  // 更新菜单高亮
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    }
  });

  // 加载页面数据
  loadPageData(pageName);
}

// 加载页面数据
async function loadPageData(page) {
  switch (page) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'products':
      await loadCategories();
      await loadProducts();
      break;
    case 'orders':
      await loadOrders();
      break;
    case 'aftersales':
      await loadAftersales();
      break;
    case 'riders':
      await loadRiders();
      break;
    case 'categories':
      await loadCategoriesAdmin();
      break;
    case 'banners':
      await loadBanners();
      break;
    case 'settings':
      await loadDeliverySlots();
      break;
  }
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    0: '待支付',
    1: '待接单',
    2: '已接单',
    3: '待取货',
    4: '配送中',
    5: '已到达',
    6: '已完成',
    7: '已取消'
  };
  return statusMap[status] || '未知';
}

// 获取状态样式类
function getStatusClass(status) {
  if (status === 0) return 'status-pending';
  if ([1, 2, 3].includes(status)) return 'status-process';
  if ([4, 5, 6].includes(status)) return 'status-success';
  if ([7, 8, 9].includes(status)) return 'status-error';
  return '';
}

// 关闭弹窗
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// 格式化金额
function formatPrice(price) {
  return parseFloat(price || 0).toFixed(2);
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN');
}