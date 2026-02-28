// Tab Jump - Options 配置脚本

let mappings = {};

const addBtn = document.getElementById('addBtn');
const mappingsList = document.getElementById('mappingsList');
const emptyState = document.getElementById('emptyState');
const shortcutLink = document.getElementById('shortcutLink');

// ===== 初始化 =====
loadMappings().then(renderMappings);

// ===== 加载配置 =====
async function loadMappings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ mappings: {} }, (data) => {
      mappings = data.mappings;
      resolve();
    });
  });
}

// ===== 保存配置 =====
async function saveMappings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ mappings }, () => {
      resolve();
      showToast();
    });
  });
}

// ===== 渲染映射列表 =====
function renderMappings() {
  const entries = Object.entries(mappings);

  if (entries.length === 0) {
    mappingsList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  mappingsList.innerHTML = entries
    .map(
      ([key, value]) => `
    <div class="mapping-item" data-key="${escapeAttr(key)}">
      <input type="text" class="key-input" value="${escapeAttr(key)}" placeholder="关键词 (如: loop)">
      <span class="arrow">→</span>
      <input type="text" class="value-input" value="${escapeAttr(value)}" placeholder="网址 (如: www.loop.com)">
      <button class="btn btn-danger delete-btn">删除</button>
    </div>`
    )
    .join('');

  // 绑定事件
  mappingsList.querySelectorAll('.mapping-item').forEach((item) => {
    const originalKey = item.dataset.key;
    const keyInput = item.querySelector('.key-input');
    const valueInput = item.querySelector('.value-input');
    const deleteBtn = item.querySelector('.delete-btn');

    // 输入变化时自动保存
    const saveChanges = debounce(() => {
      const newKey = keyInput.value.trim();
      const newValue = valueInput.value.trim();

      if (!newKey) return;

      // 如果 key 变了，删除旧 key
      if (newKey !== originalKey) {
        delete mappings[originalKey];
      }
      mappings[newKey] = newValue;
      saveMappings().then(() => renderMappings());
    }, 600);

    keyInput.addEventListener('input', saveChanges);
    valueInput.addEventListener('input', saveChanges);

    // 删除按钮
    deleteBtn.addEventListener('click', () => {
      delete mappings[originalKey];
      saveMappings().then(() => renderMappings());
    });
  });
}

// ===== 添加映射 =====
addBtn.addEventListener('click', () => {
  // 生成临时 key
  const tempKey = `keyword_${Date.now()}`;
  mappings[tempKey] = '';
  renderMappings();

  // 聚焦到新添加项的 key 输入框
  const items = mappingsList.querySelectorAll('.mapping-item');
  const lastItem = items[items.length - 1];
  if (lastItem) {
    const keyInput = lastItem.querySelector('.key-input');
    keyInput.focus();
    keyInput.select();
  }
});

// ===== 快捷键设置链接 =====
shortcutLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ===== 工具函数 =====

function showToast() {
  const toast = document.getElementById('toast');
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 1500);
}

function escapeAttr(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
