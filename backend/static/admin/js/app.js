// 关闭弹窗
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// 图片上传处理（前端预览和上传）
function initImageUpload(inputId, previewId, placeholderId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);

  if (!input || !preview || !placeholder) return;

  // 点击上传区域
  input.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;

    // 本地预览
    const reader = new FileReader();
    reader.onload = function(e) {
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
    }).then(res => res.json())
      .then(json => {
        if (json.code === 200) {
          document.getElementById('productImage').value = json.data.url;
        } else {
          alert('上传失败: ' + json.message);
        }
      })
      .catch(() => alert('上传失败'));
  });

  // 拖拽上传
  const uploadArea = preview.parentElement;
  uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.style.borderColor = '#2E7D32';
  });

  uploadArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.style.borderColor = '#E8E8E8';
  });

  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    this.style.borderColor = '#E8E8E8';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}
