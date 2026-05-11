// 登录
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(API_BASE + '/auth/merchant/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const json = await res.json();

    if (json.code === 200) {
      saveSession(json.data.token, json.data.user);
      showAdminPage();
      loadPageData('dashboard');
    } else {
      alert(json.message || '登录失败');
    }
  } catch (err) {
    alert('登录失败: ' + err.message);
  }
  return false;
}

// 退出登录
function logout() {
  clearSession();
  showLoginPage();
}

// 加载数据看板
async function loadDashboard() {
  try {
    const res = await request('/admin/dashboard');
    if (res.code === 200) {
      const d = res.data;
      document.getElementById('todayOrders').textContent = d.today_orders;
      document.getElementById('todayAmount').textContent = '¥' + formatPrice(d.today_amount);
      document.getElementById('pendingOrders').textContent = d.pending_orders;
      document.getElementById('totalCustomers').textContent = d.total_customers;
      document.getElementById('pendingOrdersQuick').textContent = d.pending_orders;

      // 渲染近7天订单柱状图
      const orderChart = document.getElementById('orderChart');
      if (orderChart && d.week_orders) {
        const maxCount = Math.max(...d.week_orders.map(w => w.count), 1);
        orderChart.innerHTML = d.week_orders.map(w => `
          <div class="bar-item">
            <div class="bar-value">${w.count}</div>
            <div class="bar" style="height:${(w.count / maxCount) * 100}px"></div>
            <div class="bar-label">${w.day_name.slice(1)}</div>
          </div>
        `).join('');
      }

      // 渲染热销商品TOP5
      const topProducts = document.getElementById('topProducts');
      if (topProducts && d.top_products) {
        topProducts.innerHTML = d.top_products.map((p, i) => `
          <div class="top-product-item">
            <div class="top-product-rank ${i < 3 ? 'rank-' + (i+1) : ''}">${i + 1}</div>
            <div class="top-product-info">
              <div class="top-product-name">${p.name}</div>
              <div class="top-product-sales">销量 ${p.sales}</div>
            </div>
          </div>
        `).join('') || '<p style="color:#999;text-align:center">暂无数据</p>';
      }
    }
  } catch (err) {
    console.error('Load dashboard error:', err);
  }
}

// 加载商品列表
async function loadProducts(page = 1) {
  try {
    const categoryId = document.getElementById('productCategoryFilter')?.value;
    const status = document.getElementById('productStatusFilter')?.value;

    const params = { page, page_size: 10 };
    if (categoryId) params.category_id = categoryId;
    if (status) params.status = status;

    const res = await request('/admin/product/list', 'GET', params);
    if (res.code === 200) {
      renderProductTable(res.data.list);
      renderPagination('productPagination', page, res.data.pages, loadProducts);
    }
  } catch (err) {
    console.error('Load products error:', err);
  }
}

// 渲染商品表格
function renderProductTable(products) {
  const tbody = document.getElementById('productTableBody');
  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.category_name || '-'}</td>
      <td>¥${formatPrice(p.price)}</td>
      <td>${p.stock}</td>
      <td><span class="status-tag ${p.status === 1 ? 'status-success' : 'status-error'}">${p.status === 1 ? '上架' : '下架'}</span></td>
      <td>
        <div class="actions">
          <button class="action-btn" onclick="editProduct(${p.id})">编辑</button>
          <button class="action-btn" onclick="toggleProductStatus(${p.id}, ${p.status})">${p.status === 1 ? '下架' : '上架'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// 加载分类（供商品表单使用）
async function loadCategories() {
  try {
    const res = await request('/admin/category/list');
    if (res.code === 200) {
      const options = res.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      document.getElementById('productCategory').innerHTML = '<option value="">选择分类</option>' + options;
      document.getElementById('productCategoryFilter').innerHTML = '<option value="">全部分类</option>' + options;
    }
  } catch (err) {
    console.error('Load categories error:', err);
  }
}

// 显示商品弹窗
async function showProductModal(id = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');

  if (id) {
    title.textContent = '编辑商品';
    const res = await request('/product/detail/' + id);
    if (res.code === 200) {
      const p = res.data;
      document.getElementById('productId').value = p.id;
      document.getElementById('productName').value = p.name;
      document.getElementById('productCategory').value = String(p.category_id || '');
      document.getElementById('productPrice').value = p.price;
      document.getElementById('productOriginalPrice').value = p.original_price || '';
      document.getElementById('productUnit').value = p.unit;
      document.getElementById('productStock').value = p.stock;
      document.getElementById('productSubtitle').value = p.subtitle || '';
      document.getElementById('productTags').value = (p.tags || []).join(',');
      document.getElementById('productImage').value = p.image || '';
      document.getElementById('productDescription').value = p.description || '';
      document.getElementById('productStatus').value = String(p.status);

      // 回填图片预览
      if (p.image) {
        const preview = document.getElementById('productImagePreview');
        const placeholder = document.getElementById('productImagePlaceholder');
        if (preview && placeholder) {
          preview.src = p.image;
          preview.classList.remove('hidden');
          placeholder.classList.add('hidden');
        }
      }
    }
  } else {
    title.textContent = '添加商品';
    document.getElementById('productId').value = '';
    document.querySelector('#productModal form').reset();
    // 清空图片预览
    const preview = document.getElementById('productImagePreview');
    const placeholder = document.getElementById('productImagePlaceholder');
    if (preview) preview.src = '';
    if (preview) preview.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
}

// 编辑商品
async function editProduct(id) {
  await showProductModal(id);
}

// 保存商品
async function saveProduct(e) {
  e.preventDefault();

  const id = document.getElementById('productId').value;
  const data = {
    name: document.getElementById('productName').value,
    category_id: document.getElementById('productCategory').value || null,
    price: parseFloat(document.getElementById('productPrice').value),
    original_price: parseFloat(document.getElementById('productOriginalPrice').value) || null,
    unit: document.getElementById('productUnit').value,
    stock: parseInt(document.getElementById('productStock').value),
    subtitle: document.getElementById('productSubtitle').value,
    tags: document.getElementById('productTags').value.split(',').filter(t => t),
    image: document.getElementById('productImage').value,
    description: document.getElementById('productDescription').value,
    status: parseInt(document.getElementById('productStatus').value)
  };

  try {
    let res;
    if (id) {
      data.id = parseInt(id);
      res = await request('/admin/product/update', 'POST', data);
    } else {
      res = await request('/admin/product/create', 'POST', data);
    }

    if (res.code === 200) {
      alert('保存成功');
      closeModal('productModal');
      loadProducts();
    } else {
      alert(res.message || '保存失败');
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
  return false;
}

// 切换商品状态
async function toggleProductStatus(id, currentStatus) {
  try {
    const res = await request('/admin/product/update', 'POST', {
      id,
      status: currentStatus === 1 ? 0 : 1
    });
    if (res.code === 200) {
      loadProducts();
    }
  } catch (err) {
    alert('操作失败');
  }
}

// 加载订单
async function loadOrders(page = 1) {
  try {
    const status = document.getElementById('orderStatusFilter')?.value;
    const params = { page, page_size: 10 };
    if (status) params.status = status;

    const res = await request('/admin/order/list', 'GET', params);
    if (res.code === 200) {
      renderOrderTable(res.data.list);
      renderPagination('orderPagination', page, res.data.pages, loadOrders);
    }
  } catch (err) {
    console.error('Load orders error:', err);
  }
}

// 渲染订单表格
function renderOrderTable(orders) {
  const tbody = document.getElementById('orderTableBody');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>${o.order_no}</td>
      <td>${o.user_nickname || '-'}</td>
      <td>¥${formatPrice(o.pay_amount)}</td>
      <td><span class="status-tag ${getStatusClass(o.status)}">${getStatusText(o.status)}</span></td>
      <td>${formatDate(o.created_at)}</td>
      <td>
        <div class="actions">
          <button class="action-btn" onclick="viewOrderDetail(${o.id})">详情</button>
          ${o.status === 0 ? '<button class="action-btn" onclick="payOrder(' + o.id + ')">标记已支付</button><button class="action-btn" onclick="cancelOrderAdmin(' + o.id + ')">取消</button>' : ''}
          ${o.status === 1 ? '<button class="action-btn" onclick="acceptOrder(' + o.id + ')">接单</button><button class="action-btn" onclick="rejectOrder(' + o.id + ')">拒单</button>' : ''}
          ${o.status === 4 ? '<button class="action-btn" onclick="deliverOrder(' + o.id + ')">标记已送达</button>' : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// 查看订单详情
async function viewOrderDetail(id) {
  try {
    const res = await request('/admin/order/detail/' + id);
    if (res.code === 200) {
      const d = res.data;
      let actionsHtml = '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;">';
      if (d.status === 0) {
        actionsHtml += '<button class="btn-primary" onclick="payOrder(' + d.id + ');closeModal(\'orderDetailModal\')">标记已支付</button> ';
        actionsHtml += '<button class="btn-secondary" onclick="cancelOrderAdmin(' + d.id + ');closeModal(\'orderDetailModal\')">取消订单</button> ';
      }
      if (d.status === 1) {
        actionsHtml += '<button class="btn-primary" onclick="acceptOrder(' + d.id + ');closeModal(\'orderDetailModal\')">接单</button> ';
        actionsHtml += '<button class="btn-secondary" onclick="rejectOrder(' + d.id + ');closeModal(\'orderDetailModal\')">拒单</button> ';
      }
      if (d.status === 4) {
        actionsHtml += '<button class="btn-primary" onclick="deliverOrder(' + d.id + ');closeModal(\'orderDetailModal\')">标记已送达</button> ';
      }
      actionsHtml += '</div>';

      const content = `
        <div class="order-info">
          <div class="order-info-item"><span class="label">订单号:</span><span class="value">${d.order_no}</span></div>
          <div class="order-info-item"><span class="label">用户:</span><span class="value">${d.user?.nickname || '-'}${d.user?.phone ? ' (' + d.user.phone + ')' : ''}</span></div>
          <div class="order-info-item"><span class="label">金额:</span><span class="value">¥${formatPrice(d.pay_amount)}</span></div>
          <div class="order-info-item"><span class="label">状态:</span><span class="value"><span class="status-tag ${getStatusClass(d.status)}">${getStatusText(d.status)}</span></span></div>
          <div class="order-info-item"><span class="label">下单时间:</span><span class="value">${formatDate(d.created_at)}</span></div>
          ${d.remark ? '<div class="order-info-item"><span class="label">备注:</span><span class="value">' + d.remark + '</span></div>' : ''}
          ${d.address ? '<div class="order-info-item"><span class="label">收货地址:</span><span class="value">' + d.address.name + ' ' + d.address.phone + '<br>' + d.address.detail + '</span></div>' : ''}
          ${d.delivery_time ? '<div class="order-info-item"><span class="label">配送时段:</span><span class="value">' + d.delivery_time + '</span></div>' : ''}
        </div>
        <h4 style="margin: 16px 0 8px">商品明细:</h4>
        <table class="data-table">
          <thead><tr><th>商品</th><th>单价</th><th>数量</th><th>小计</th></tr></thead>
          <tbody>
            ${d.items.map(item => `<tr><td>${item.name}</td><td>¥${formatPrice(item.price)}</td><td>${item.quantity}</td><td>¥${formatPrice(item.subtotal)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:16px;text-align:right;font-size:16px;font-weight:600">
          合计: ¥${formatPrice(d.pay_amount)}
        </div>
        ${d.rider ? '<p style="margin-top:16px">骑手: ' + d.rider.nickname + '</p>' : ''}
        ${actionsHtml}
      `;
      document.getElementById('orderDetailContent').innerHTML = content;
      document.getElementById('orderDetailModal').classList.remove('hidden');
    }
  } catch (err) {
    alert('加载失败');
  }
}

// 接单
async function acceptOrder(id) {
  if (!confirm('确认接单?')) return;
  try {
    // 接单后需要分配骑手
    const riderId = prompt('请输入骑手ID（可先接单稍后分配）');
    const res = await request('/admin/order/accept', 'POST', { order_id: id, rider_id: riderId || null });
    if (res.code === 200) {
      alert('接单成功');
      loadOrders();
    }
  } catch (err) {
    alert('操作失败');
  }
}

// 标记已支付（管理员）
async function payOrder(id) {
  if (!confirm('确认该订单已支付?')) return;
  try {
    const res = await request('/admin/order/pay', 'POST', { order_id: id });
    if (res.code === 200) {
      alert('已标记为已支付');
      loadOrders();
      closeModal('orderDetailModal');
    } else {
      alert(res.message || '操作失败');
    }
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 取消订单（管理员）
async function cancelOrderAdmin(id) {
  if (!confirm('确认取消该订单?')) return;
  try {
    const res = await request('/admin/order/cancel', 'POST', { order_id: id, reason: '商家取消' });
    if (res.code === 200) {
      alert('订单已取消');
      loadOrders();
      closeModal('orderDetailModal');
    } else {
      alert(res.message || '操作失败');
    }
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 拒单
async function rejectOrder(id) {
  if (!confirm('确认拒单?')) return;
  try {
    const res = await request('/admin/order/cancel', 'POST', { order_id: id, reason: '商家拒单' });
    if (res.code === 200) {
      alert('已拒单');
      loadOrders();
      closeModal('orderDetailModal');
    } else {
      alert(res.message || '操作失败');
    }
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 标记已送达
async function deliverOrder(id) {
  if (!confirm('确认已送达?')) return;
  try {
    const res = await request('/order/confirm', 'POST', { order_id: id });
    if (res.code === 200) {
      alert('已标记为已完成');
      loadOrders();
      closeModal('orderDetailModal');
    } else {
      alert(res.message || '操作失败');
    }
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 加载骑手
async function loadRiders() {
  try {
    const res = await request('/admin/rider/list');
    if (res.code === 200) {
      const tbody = document.getElementById('riderTableBody');
      if (res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999">暂无数据</td></tr>';
        return;
      }
      tbody.innerHTML = res.data.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.nickname || '-'}</td>
          <td>${r.phone || '-'}</td>
          <td>${r.today_deliveries || 0}</td>
          <td><span class="status-tag ${r.status === 1 ? 'status-success' : 'status-error'}">${r.status === 1 ? '在线' : '离线'}</span></td>
          <td>
            <div class="actions">
              <button class="action-btn" onclick="editRider(${r.id})">编辑</button>
              <button class="action-btn" onclick="toggleRiderStatus(${r.id})">${r.status === 1 ? '下线' : '上线'}</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Load riders error:', err);
  }
}

// 添加骑手弹窗
function showAddRiderModal() {
  document.getElementById('riderModalTitle').textContent = '添加骑手';
  document.getElementById('riderId').value = '';
  document.getElementById('riderName').value = '';
  document.getElementById('riderPhone').value = '';
  document.getElementById('riderPassword').value = 'rider123';
  document.getElementById('riderDeleteBtn').style.display = 'none';
  document.getElementById('riderModal').classList.remove('hidden');
}

// 编辑骑手弹窗
async function editRider(id) {
  try {
    const res = await request('/admin/rider/list');
    if (res.code === 200) {
      const rider = res.data.find(r => r.id === id);
      if (rider) {
        document.getElementById('riderModalTitle').textContent = '编辑骑手';
        document.getElementById('riderId').value = rider.id;
        document.getElementById('riderName').value = rider.nickname || '';
        document.getElementById('riderPhone').value = rider.phone || '';
        document.getElementById('riderPassword').value = '';
        document.getElementById('riderPassword').placeholder = '留空则不修改密码';
        document.getElementById('riderDeleteBtn').style.display = 'block';
        document.getElementById('riderModal').classList.remove('hidden');
      }
    }
  } catch (err) {
    alert('加载失败');
  }
}

// 保存骑手
async function saveRider(e) {
  e.preventDefault();
  const id = document.getElementById('riderId').value;
  const data = {
    nickname: document.getElementById('riderName').value,
    phone: document.getElementById('riderPhone').value
  };

  if (!data.nickname || !data.phone) {
    alert('姓名和手机号不能为空');
    return;
  }

  try {
    let res;
    if (id) {
      data.id = parseInt(id);
      res = await request('/admin/rider/update', 'POST', data);
    } else {
      res = await request('/admin/rider/create', 'POST', data);
    }

    if (res.code === 200) {
      alert(id ? '修改成功' : '添加成功');
      if (!id && res.data && res.data.password) {
        alert('默认密码是: rider123');
      }
      closeModal('riderModal');
      loadRiders();
    } else {
      alert(res.message || '操作失败');
    }
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 删除骑手
async function deleteRider(id) {
  if (!confirm('确认删除该骑手?')) return;
  try {
    const res = await request('/admin/rider/delete', 'POST', { id });
    if (res.code === 200) {
      alert('删除成功');
      closeModal('riderModal');
      loadRiders();
    } else {
      alert(res.message || '删除失败');
    }
  } catch (err) {
    alert('删除失败');
  }
}

// 切换骑手状态
async function toggleRiderStatus(id) {
  try {
    const res = await request('/admin/rider/toggle', 'POST', { id });
    if (res.code === 200) {
      loadRiders();
    }
  } catch (err) {
    alert('操作失败');
  }
}

// 加载分类管理
async function loadCategoriesAdmin() {
  try {
    const res = await request('/admin/category/list');
    if (res.code === 200) {
      const tbody = document.getElementById('categoryTableBody');
      tbody.innerHTML = res.data.map(c => `
        <tr>
          <td>${c.sort_order}</td>
          <td>${c.name}</td>
          <td><span class="status-tag ${c.status === 1 ? 'status-success' : 'status-error'}">${c.status === 1 ? '显示' : '隐藏'}</span></td>
          <td><button class="action-btn" onclick="editCategory(${c.id})">编辑</button></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Load categories error:', err);
  }
}

// 显示分类弹窗
async function showCategoryModal(id = null) {
  const name = prompt(id ? '修改分类名称:' : '输入分类名称:');
  if (!name) return;

  try {
    let res;
    if (id) {
      res = await request('/admin/category/update', 'POST', { id, name });
    } else {
      res = await request('/admin/category/create', 'POST', { name });
    }
    if (res.code === 200) {
      alert(id ? '修改成功' : '添加成功');
      loadCategoriesAdmin();
    } else {
      alert(res.message || '操作失败');
    }
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 编辑分类
function editCategory(id) {
  showCategoryModal(id);
}

// 加载轮播图
async function loadBanners() {
  try {
    const res = await request('/admin/banner/list');
    if (res.code === 200) {
      const tbody = document.getElementById('bannerTableBody');
      if (res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999">暂无数据</td></tr>';
        return;
      }
      tbody.innerHTML = res.data.map(b => `
        <tr>
          <td>${b.title || '-'}</td>
          <td><img src="${b.image}" style="width:60px;height:40px;object-fit:cover;border-radius:4px"></td>
          <td>${b.sort_order}</td>
          <td><span class="status-tag ${b.status === 1 ? 'status-success' : 'status-error'}">${b.status === 1 ? '显示' : '隐藏'}</span></td>
          <td><button class="action-btn" onclick="deleteBanner(${b.id})">删除</button></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Load banners error:', err);
  }
}

// 显示轮播图弹窗
// 显示轮播图弹窗
function showBannerModal(id = null) {
  const modal = document.getElementById('bannerModal');
  const title = document.getElementById('bannerModalTitle');

  if (id) {
    // 编辑模式：加载现有数据
    title.textContent = '编辑轮播图';
    request('/admin/banner/' + id).then(res => {
      if (res.code === 200) {
        document.getElementById('bannerId').value = res.data.id;
        document.getElementById('bannerTitle').value = res.data.title;
        document.getElementById('bannerSortOrder').value = res.data.sort_order || 0;
        if (res.data.image) {
          document.getElementById('bannerImage').value = res.data.image;
          document.getElementById('bannerImagePreview').src = res.data.image;
          document.getElementById('bannerImagePreview').classList.remove('hidden');
          document.getElementById('bannerImagePlaceholder').classList.add('hidden');
        }
      }
    });
  } else {
    title.textContent = '添加轮播图';
    document.getElementById('bannerId').value = '';
    document.querySelector('#bannerModal form').reset();
    const preview = document.getElementById('bannerImagePreview');
    const placeholder = document.getElementById('bannerImagePlaceholder');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    if (placeholder) placeholder.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
}

// 处理轮播图上传
function handleBannerImageUpload(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  // 本地预览
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('bannerImagePreview');
    const placeholder = document.getElementById('bannerImagePlaceholder');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);

  // 上传到服务器
  const formData = new FormData();
  formData.append('image', file);

  fetch(API_BASE + '/upload/image', {
    method: 'POST',
    headers: getHeaders(),
    body: formData
  }).then(res => res.json()).then(json => {
    if (json.code === 200) {
      document.getElementById('bannerImage').value = json.data.url;
    } else {
      alert('上传失败: ' + json.message);
    }
  }).catch(() => alert('上传失败'));
}

// 保存轮播图
async function saveBanner(e) {
  e.preventDefault();
  const id = document.getElementById('bannerId').value;
  const data = {
    title: document.getElementById('bannerTitle').value,
    image: document.getElementById('bannerImage').value,
    sort_order: parseInt(document.getElementById('bannerSortOrder').value) || 0
  };

  try {
    let res;
    if (id) {
      data.id = parseInt(id);
      res = await request('/admin/banner/update', 'POST', data);
    } else {
      res = await request('/admin/banner/create', 'POST', data);
    }
    if (res.code === 200) {
      alert('保存成功');
      closeModal('bannerModal');
      loadBanners();
    } else {
      alert(res.message || '保存失败');
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
  return false;
}

// 删除轮播图
async function deleteBanner(id) {
  if (!confirm('确认删除?')) return;
  try {
    const res = await request('/admin/banner/delete', 'POST', { id });
    if (res.code === 200) {
      loadBanners();
    } else {
      alert(res.message || '删除失败');
    }
  } catch (err) {
    alert('删除失败');
  }
}

// 加载配送时间段
async function loadDeliverySlots() {
  try {
    const res = await request('/admin/delivery/slots');
    if (res.code === 200) {
      const container = document.getElementById('deliverySlotsList');
      container.innerHTML = res.data.map(s => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f5f5f5;border-radius:4px;margin-bottom:8px">
          <div>
            <span style="font-weight:500">${s.name}</span>
            <span style="color:#666;margin-left:8px">${s.start_time}-${s.end_time}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="status-tag ${s.status === 1 ? 'status-success' : 'status-error'}">${s.status === 1 ? '可用' : '禁用'}</span>
            <button class="action-btn" onclick="editSlot(${s.id})">编辑</button>
          </div>
        </div>
      `).join('') || '<p style="color:#999">暂无时间段</p>';
    }
  } catch (err) {
    console.error('Load slots error:', err);
  }
}

// 显示时间段弹窗
function showSlotModal(id = null) {
  const modal = document.getElementById('slotModal');
  const title = document.getElementById('slotModalTitle');
  const deleteBtn = document.getElementById('slotDeleteBtn');

  if (id) {
    title.textContent = '编辑时间段';
    deleteBtn.style.display = 'block';
    document.getElementById('slotId').value = id;

    // 加载现有数据
    request('/admin/delivery/slots').then(res => {
      if (res.code === 200) {
        const slot = res.data.find(s => s.id === id);
        if (slot) {
          document.getElementById('slotName').value = slot.name;
          document.getElementById('slotStartTime').value = slot.start_time;
          document.getElementById('slotEndTime').value = slot.end_time;
          document.getElementById('slotMaxOrders').value = slot.max_orders;
        }
      }
    });
  } else {
    title.textContent = '添加时间段';
    deleteBtn.style.display = 'none';
    document.getElementById('slotId').value = '';
    document.getElementById('slotName').value = '';
    document.getElementById('slotStartTime').value = '';
    document.getElementById('slotEndTime').value = '';
    document.getElementById('slotMaxOrders').value = '50';
  }

  modal.classList.remove('hidden');
}

// 编辑时间段（从列表点击）
function editSlot(id) {
  showSlotModal(id);
}

// 保存时间段
async function saveSlot(e) {
  e.preventDefault();
  const id = document.getElementById('slotId').value;
  const data = {
    name: document.getElementById('slotName').value,
    start_time: document.getElementById('slotStartTime').value,
    end_time: document.getElementById('slotEndTime').value,
    max_orders: parseInt(document.getElementById('slotMaxOrders').value) || 50
  };

  try {
    let res;
    if (id) {
      data.id = parseInt(id);
      res = await request('/admin/delivery/slot/update', 'POST', data);
    } else {
      res = await request('/admin/delivery/slot/create', 'POST', data);
    }
    if (res.code === 200) {
      alert('保存成功');
      closeModal('slotModal');
      loadDeliverySlots();
    } else {
      alert(res.message || '保存失败');
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
  return false;
}

// 删除时间段
async function deleteSlot() {
  const id = document.getElementById('slotId').value;
  if (!id) return;
  if (!confirm('确认删除该时间段?')) return;

  try {
    const res = await request('/admin/delivery/slot/delete', 'POST', { id: parseInt(id) });
    if (res.code === 200) {
      alert('删除成功');
      closeModal('slotModal');
      loadDeliverySlots();
    } else {
      alert(res.message || '删除失败');
    }
  } catch (err) {
    alert('删除失败');
  }
}

// 分配订单给骑手
async function assignOrderToRider(riderId) {
  alert('请在订单详情中分配骑手');
}

// 渲染分页
function renderPagination(containerId, current, total, callback) {
  const container = document.getElementById(containerId);
  if (total <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button ${i === current ? 'class="active"' : ''} onclick="${callback.name}(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  // 恢复session
  if (restoreSession()) {
    showAdminPage();
    loadPageData('dashboard');
  } else {
    showLoginPage();
  }

  // 菜单点击
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      switchPage(this.dataset.page);
    });
  });
});
// 图片上传处理
async function handleImageUpload(fileInput, targetInputId) {
  const file = fileInput.files[0];
  if (!file) return;

  // 显示本地预览
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById(targetInputId + 'Preview');
    const placeholder = document.getElementById(targetInputId + 'Placeholder');
    if (preview && placeholder) {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    }
  };
  reader.readAsDataURL(file);

  // 上传到服务器
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(API_BASE + '/upload/image', {
      method: 'POST',
      headers: getHeaders(),
      body: formData
    });
    const json = await res.json();
    if (json.code === 200) {
      document.getElementById(targetInputId).value = json.data.url;
    } else {
      alert('上传失败: ' + json.message);
    }
  } catch (err) {
    alert('上传失败');
  }
}

// ========== 售后管理 ==========

// 加载售后列表
async function loadAftersales(page = 1) {
  try {
    const status = document.getElementById('aftersaleStatusFilter')?.value;
    const params = { page, page_size: 10 };
    if (status) params.status = status;

    const res = await request('/admin/aftersale/list', 'GET', params);
    if (res.code === 200) {
      renderAftersaleTable(res.data.list);
      renderPagination('aftersalePagination', page, res.data.pages, loadAftersales);
    }
  } catch (err) {
    console.error('Load aftersales error:', err);
  }
}

// 渲染售后表格
function renderAftersaleTable(aftersales) {
  const tbody = document.getElementById('aftersaleTableBody');
  if (!aftersales || aftersales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = aftersales.map(a => `
    <tr>
      <td>${a.order_no}</td>
      <td>${a.user_name || '-'}</td>
      <td><span class="type-tag ${a.type === 1 ? 'type-return' : 'type-refund'}">${a.type_text}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.reason}">${a.reason}</td>
      <td>¥${formatPrice(a.pay_amount)}</td>
      <td><span class="status-tag ${getAftersaleStatusClass(a.status)}">${a.status_text}</span></td>
      <td>${formatDate(a.created_at)}</td>
      <td>
        <div class="actions">
          <button class="action-btn" onclick="viewAftersaleDetail(${a.id})">详情</button>
          ${a.status === 0 ? '<button class="action-btn" onclick="handleAftersale(' + a.id + ', \'approve\')">同意</button><button class="action-btn btn-danger" onclick="handleAftersale(' + a.id + ', \'reject\')">拒绝</button>' : ''}
          ${a.status === 1 ? '<button class="action-btn" onclick="completeAftersale(' + a.id + ')">确认退款</button>' : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// 获取售后状态样式
function getAftersaleStatusClass(status) {
  const classes = {
    0: 'status-pending',
    1: 'status-process',
    2: 'status-error',
    3: 'status-success'
  };
  return classes[status] || '';
}

// 查看售后详情
async function viewAftersaleDetail(id) {
  try {
    const res = await request('/admin/aftersale/detail/' + id);
    if (res.code === 200) {
      const d = res.data;
      let actionsHtml = '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;">';
      if (d.status === 0) {
        actionsHtml += '<button class="btn-primary" onclick="showHandleAftersaleModal(' + d.id + ', \'approve\')">同意申请</button> ';
        actionsHtml += '<button class="btn-danger" onclick="showHandleAftersaleModal(' + d.id + ', \'reject\')">拒绝申请</button> ';
      }
      if (d.status === 1) {
        actionsHtml += '<button class="btn-primary" onclick="completeAftersale(' + d.id + ')">确认退款完成</button> ';
      }
      actionsHtml += '</div>';

      const imagesHtml = d.images && d.images.length > 0
        ? `<div style="margin-top:8px"><p style="margin-bottom:4px">凭证图片:</p><div style="display:flex;gap:8px">${d.images.map(img => `<img src="${img}" style="width:60px;height:60px;object-fit:cover;border-radius:4px">`).join('')}</div></div>`
        : '';

      const content = `
        <div class="order-info">
          <div class="order-info-item"><span class="label">订单号:</span><span class="value">${d.order_no}</span></div>
          <div class="order-info-item"><span class="label">用户:</span><span class="value">${d.user?.name || '-'}${d.user?.phone ? ' (' + d.user.phone + ')' : ''}</span></div>
          <div class="order-info-item"><span class="label">售后类型:</span><span class="value"><span class="type-tag ${d.type === 1 ? 'type-return' : 'type-refund'}">${d.type_text}</span></span></div>
          <div class="order-info-item"><span class="label">订单金额:</span><span class="value">¥${formatPrice(d.pay_amount)}</span></div>
          ${d.refund_amount ? '<div class="order-info-item"><span class="label">退款金额:</span><span class="value" style="color:#FF6B00;font-weight:bold">¥' + formatPrice(d.refund_amount) + '</span></div>' : ''}
          <div class="order-info-item"><span class="label">状态:</span><span class="value"><span class="status-tag ${getAftersaleStatusClass(d.status)}">${d.status_text}</span></span></div>
          <div class="order-info-item"><span class="label">申请时间:</span><span class="value">${formatDate(d.created_at)}</span></div>
          <div class="order-info-item"><span class="label">退款原因:</span><span class="value">${d.reason}</span></div>
          ${imagesHtml}
          ${d.admin_note ? '<div class="order-info-item"><span class="label">商家备注:</span><span class="value">' + d.admin_note + '</span></div>' : ''}
        </div>
        <h4 style="margin: 16px 0 8px">商品明细:</h4>
        <table class="data-table">
          <thead><tr><th>商品</th><th>数量</th></tr></thead>
          <tbody>
            ${d.items.map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td></tr>`).join('')}
          </tbody>
        </table>
        ${d.address ? '<p style="margin-top:16px">收货地址: ' + d.address.name + ' ' + d.address.phone + '<br>' + d.address.detail + '</p>' : ''}
        ${actionsHtml}
      `;
      document.getElementById('orderDetailContent').innerHTML = content;
      document.getElementById('orderDetailModal').classList.remove('hidden');
    }
  } catch (err) {
    alert('加载失败');
  }
}

// 显示处理售后弹窗
function showHandleAftersaleModal(id, action) {
  const title = action === 'approve' ? '同意售后申请' : '拒绝售后申请';
  const refundAmount = action === 'approve' ? prompt('请输入退款金额（留空则退全款）:', '') : '';
  const adminNote = prompt('请输入备注（可选）:', '');

  if (action === 'approve' && refundAmount === null) return;
  if (action === 'reject' && !confirm('确认拒绝该售后申请？')) return;

  handleAftersaleSubmit(id, action, refundAmount, adminNote);
}

// 处理售后申请
async function handleAftersaleSubmit(id, action, refundAmount, adminNote) {
  try {
    const data = {
      aftersale_id: id,
      action: action,
      admin_note: adminNote || ''
    };
    if (action === 'approve' && refundAmount) {
      data.refund_amount = parseFloat(refundAmount);
    }

    const res = await request('/admin/aftersale/handle', 'POST', data);
    if (res.code === 200) {
      alert('处理成功');
      closeModal('orderDetailModal');
      loadAftersales();
    } else {
      alert(res.message || '处理失败');
    }
  } catch (err) {
    alert('处理失败');
  }
}

// 确认退款完成
async function completeAftersale(id) {
  if (!confirm('确认退款已完成？')) return;

  try {
    const res = await request('/admin/aftersale/complete', 'POST', { aftersale_id: id });
    if (res.code === 200) {
      alert('退款已完成');
      closeModal('orderDetailModal');
      loadAftersales();
    } else {
      alert(res.message || '操作失败');
    }
  } catch (err) {
    alert('操作失败');
  }
}
