// Rider H5 App
(function() {
  'use strict';

  // State
  var currentRider = null;
  var authToken = null;
  var API_BASE = '/api';

  // Debug
  console.log('App started, DOM ready');

  // ==================== Init ====================

  function init() {
    console.log('Init called');
    restoreSession();
  }

  function restoreSession() {
    console.log('Restoring session...');
    var token = localStorage.getItem('rider_token');
    var user = localStorage.getItem('rider_user');
    console.log('Token exists:', !!token, 'User exists:', !!user);

    if (token && user) {
      authToken = token;
      try {
        currentRider = JSON.parse(user);
      } catch(e) {
        currentRider = null;
      }
    }

    if (authToken && currentRider) {
      showMainPage();
      loadAllData();
    } else {
      showLoginPage();
    }
  }

  // ==================== Login ====================

  function handleLogin(e) {
    e.preventDefault();
    console.log('Login form submitted');
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    if (!username || !password) {
      showToast('请输入用户名和密码');
      return;
    }

    setLoading(true);
    fetch(API_BASE + '/rider/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      console.log('Login response:', json);
      setLoading(false);
      if (json.code === 200) {
        authToken = json.data.token;
        currentRider = json.data.user;
        localStorage.setItem('rider_token', authToken);
        localStorage.setItem('rider_user', JSON.stringify(currentRider));
        showMainPage();
        loadAllData();
        showToast('登录成功');
      } else {
        showToast(json.message || '登录失败');
      }
    })
    .catch(function(err) {
      console.error('Login error:', err);
      setLoading(false);
      showToast('网络错误');
    });
  }

  function logout() {
    authToken = null;
    currentRider = null;
    localStorage.removeItem('rider_token');
    localStorage.removeItem('rider_user');
    showLoginPage();
    showToast('已退出登录');
  }

  // ==================== Page Navigation ====================

  function showLoginPage() {
    console.log('Showing login page');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('tabBar').classList.add('hidden');
    hideAllPages();
  }

  function showMainPage() {
    console.log('Showing main page');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('tabBar').classList.remove('hidden');
    switchTab('pending');
  }

  function hideAllPages() {
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.add('hidden');
    }
  }

  function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    hideAllPages();
    var targetPage = document.getElementById(tabName + 'Page');
    if (targetPage) {
      targetPage.classList.remove('hidden');
    }

    var tabs = document.querySelectorAll('.tab-item');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove('active');
      if (tabs[i].getAttribute('data-page') === tabName) {
        tabs[i].classList.add('active');
      }
    }
  }

  // ==================== Data Loading ====================

  function loadAllData() {
    loadRiderInfo();
    loadPendingOrders();
    loadDeliveringOrders();
    loadHistoryOrders();
    loadStats();
  }

  function loadRiderInfo() {
    if (!currentRider) return;
    var nameEl = document.getElementById('riderName');
    var myNameEl = document.getElementById('myName');
    var myPhoneEl = document.getElementById('myPhone');
    if (nameEl) nameEl.textContent = currentRider.nickname || '骑手';
    if (myNameEl) myNameEl.textContent = currentRider.nickname || '骑手';
    if (myPhoneEl) myPhoneEl.textContent = currentRider.phone || '';
  }

  function loadPendingOrders() {
    apiRequest('/rider/orders/pending', 'GET')
      .then(function(json) {
        var list = json.data || [];
        renderPendingOrders(list);
        var todayCountEl = document.getElementById('todayCount');
        if (todayCountEl) todayCountEl.textContent = list.length;
      })
      .catch(function(e) { console.error(e); });
  }

  function loadDeliveringOrders() {
    apiRequest('/rider/orders/delivering', 'GET')
      .then(function(json) {
        var list = json.data || [];
        renderDeliveringOrders(list);
        var countEl = document.getElementById('deliveringCount');
        if (countEl) countEl.textContent = list.length + ' 单';
      })
      .catch(function(e) { console.error(e); });
  }

  function loadHistoryOrders() {
    apiRequest('/rider/orders/history', 'GET')
      .then(function(json) {
        renderHistoryOrders(json.data || []);
      })
      .catch(function(e) { console.error(e); });
  }

  function loadStats() {
    apiRequest('/rider/stats', 'GET')
      .then(function(json) {
        var todayEl = document.getElementById('myTodayCount');
        var weekEl = document.getElementById('myWeekCount');
        if (todayEl) todayEl.textContent = json.data.today_count || 0;
        if (weekEl) weekEl.textContent = json.data.week_count || 0;
      })
      .catch(function(e) { console.error(e); });
  }

  // ==================== Render ====================

  function renderPendingOrders(list) {
    var container = document.getElementById('pendingList');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无待取货订单</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < list.length; i++) {
      var order = list[i];
      var addr = order.address || {};
      html += '<div class="order-card">' +
        '<div class="order-card-header">' +
          '<span class="order-no">' + order.order_no + '</span>' +
          '<span class="status-badge status-1">待取货</span>' +
        '</div>' +
        '<div class="order-address">' +
          '<div class="address-row">' +
            '<span class="address-icon">📍</span>' +
            '<div class="address-text">' +
              '<div class="address-name">' + (addr.name || '') + ' ' + (addr.phone || '') + '</div>' +
              '<div class="address-detail">' + (addr.detail || '') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="order-items">' +
          '<span class="items-text">' + (order.item_summary || '') + '</span>' +
        '</div>' +
        '<div class="order-card-header">' +
          '<span class="order-no"></span>' +
          '<span class="order-amount">¥' + (order.pay_amount || 0).toFixed(2) + '</span>' +
        '</div>' +
        '<div class="order-actions">' +
          '<a href="tel:' + (addr.phone || '') + '" class="action-btn btn-call">📞 联系客户</a>' +
          '<button class="action-btn btn-start" onclick="startDelivery(' + order.delivery_id + ')">开始配送</button>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  function renderDeliveringOrders(list) {
    var container = document.getElementById('deliveringList');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无配送中订单</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < list.length; i++) {
      var order = list[i];
      var addr = order.address || {};
      var statusText = {2: '取货中', 3: '配送中', 4: '已到达'}[order.status] || '';
      html += '<div class="order-card">' +
        '<div class="order-card-header">' +
          '<span class="order-no">' + order.order_no + '</span>' +
          '<span class="status-badge status-' + order.status + '">' + statusText + '</span>' +
        '</div>' +
        '<div class="order-address">' +
          '<div class="address-row">' +
            '<span class="address-icon">📍</span>' +
            '<div class="address-text">' +
              '<div class="address-name">' + (addr.name || '') + '</div>' +
              '<div class="address-detail">' + (addr.phone || '') + ' · ' + (addr.detail || '') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="order-items">' +
          '<span class="items-text">' + (order.item_summary || '') + '</span>' +
        '</div>' +
        '<div class="order-card-header">' +
          '<span class="order-no"></span>' +
          '<span class="order-amount">¥' + (order.pay_amount || 0).toFixed(2) + '</span>' +
        '</div>' +
        '<div class="order-actions">' +
          '<a href="tel:' + (addr.phone || '') + '" class="action-btn btn-call">📞 拨打客户</a>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  function renderHistoryOrders(list) {
    var container = document.getElementById('historyList');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
      return;
    }

    var grouped = {};
    for (var i = 0; i < list.length; i++) {
      var order = list[i];
      var date = (order.complete_time || '').split(' ')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(order);
    }

    var html = '';
    var dates = Object.keys(grouped).sort(function(a, b) { return b.localeCompare(a); });
    for (var d = 0; d < dates.length; d++) {
      var dateStr = dates[d];
      html += '<div class="history-date">' + dateStr + '</div>';
      for (var j = 0; j < grouped[dateStr].length; j++) {
        var o = grouped[dateStr][j];
        html += '<div class="history-card">' +
          '<div class="history-item">' +
            '<div class="history-left">' +
              '<div class="history-order-no">' + o.order_no + '</div>' +
              '<div class="history-time">' + o.complete_time + '</div>' +
            '</div>' +
            '<span class="history-amount">¥' + (o.total_amount || 0).toFixed(2) + '</span>' +
          '</div>' +
        '</div>';
      }
    }
    container.innerHTML = html;
  }

  // ==================== Delivery Actions ====================

  function startDelivery(deliveryId) {
    showConfirm(deliveryId, 'start');
  }

  var pendingAction = null;

  function showConfirm(deliveryId, action) {
    pendingAction = { deliveryId: deliveryId, action: action };
    var modal = document.getElementById('confirmModal');
    var textEl = document.getElementById('confirmText');
    if (textEl) {
      textEl.textContent = action === 'start' ? '确认开始配送？' : '确认货物已送达客户手中？';
    }
    if (modal) modal.classList.remove('hidden');
  }

  function closeModal() {
    var modal = document.getElementById('confirmModal');
    if (modal) modal.classList.add('hidden');
    pendingAction = null;
  }

  function doConfirm() {
    if (!pendingAction) return;
    var deliveryId = pendingAction.deliveryId;
    var action = pendingAction.action;
    closeModal();

    if (action === 'start') {
      apiRequest('/rider/order/start', 'POST', { delivery_id: deliveryId })
        .then(function(json) {
          showToast(json.message || '已开始配送');
          loadAllData();
        })
        .catch(function(e) { showToast(e.message || '操作失败'); });
    } else if (action === 'complete') {
      apiRequest('/rider/order/complete', 'POST', { delivery_id: deliveryId })
        .then(function(json) {
          showToast(json.message || '配送完成');
          loadAllData();
        })
        .catch(function(e) { showToast(e.message || '操作失败'); });
    }
  }

  // ==================== API Request ====================

  function apiRequest(url, method, data) {
    var headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = 'Bearer ' + authToken;
    }

    var options = {
      method: method || 'GET',
      headers: headers
    };

    var fullUrl = API_BASE + url;
    if (data && method === 'GET') {
      var params = [];
      for (var key in data) {
        if (data[key] !== null && data[key] !== undefined) {
          params.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
        }
      }
      if (params.length > 0) {
        fullUrl += '?' + params.join('&');
      }
      data = null;
    } else if (data) {
      options.body = JSON.stringify(data);
    }

    return fetch(fullUrl, options).then(function(res) {
      return res.json().then(function(json) {
        if (json.code === 401) {
          logout();
          showToast('请重新登录');
          throw new Error(json.message);
        }
        if (json.code !== 200) {
          throw new Error(json.message || '请求失败');
        }
        return json;
      });
    });
  }

  // ==================== Utilities ====================

  function showToast(message) {
    var toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.remove('hidden');
      setTimeout(function() {
        toast.classList.add('hidden');
      }, 2000);
    }
  }

  function setLoading(loading) {
    document.body.style.opacity = loading ? '0.7' : '1';
  }

  // Expose functions to global scope
  window.handleLogin = handleLogin;
  window.logout = logout;
  window.switchTab = switchTab;
  window.startDelivery = startDelivery;
  window.showConfirm = showConfirm;
  window.closeModal = closeModal;
  window.doConfirm = doConfirm;

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();