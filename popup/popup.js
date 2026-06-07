// Tab Jump - Popup 搜索脚本

let activeIndex = -1;
let results = [];

const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('resultsList');
const openOptions = document.getElementById('openOptions');
const reloadAllTabs = document.getElementById('reloadAllTabs');

// ===== 初始化 =====
searchInput.focus();

// ===== 打开设置页 =====
openOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ===== 重新加载所有 Tab =====
reloadAllTabs.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    chrome.tabs.reload(tab.id);
  }
  reloadAllTabs.classList.add('success');
  reloadAllTabs.querySelector('svg').style.display = 'none';
  reloadAllTabs.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    已刷新 ${tabs.length} 个标签页`;
  setTimeout(() => window.close(), 800);
});

// ===== 搜索输入监听 =====
searchInput.addEventListener('input', debounce(handleSearch, 120));

// ===== 键盘导航 =====
searchInput.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
      updateActiveItem();
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveItem();
      break;
    case 'Enter':
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        selectResult(results[activeIndex]);
      }
      break;
    case 'Escape':
      window.close();
      break;
  }
});

// ===== 核心搜索逻辑 =====
async function handleSearch() {
  const rawQuery = searchInput.value.trim().toLowerCase();

  if (!rawQuery) {
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        输入关键词开始搜索...（空格分隔多个关键词）
      </div>`;
    results = [];
    activeIndex = -1;
    return;
  }

  // 空格分隔多个关键词，过滤空字符串
  const keywords = rawQuery.split(/\s+/).filter(Boolean);

  // 并行获取配置和标签页
  const [config, tabs] = await Promise.all([
    getConfig(),
    chrome.tabs.query({ currentWindow: true })
  ]);

  results = [];

  // 1. 检查配置中是否有匹配的 key（所有关键词都需要匹配 key 或 value）
  const configMatches = [];
  for (const [key, value] of Object.entries(config)) {
    const keyLower = key.toLowerCase();
    const valueLower = value.toLowerCase();
    const matched = keywords.every(
      (kw) => keyLower.includes(kw) || valueLower.includes(kw)
    );
    if (matched) {
      configMatches.push({
        type: 'config',
        key,
        url: value,
        displayUrl: value,
        title: `${key} → ${value}`,
        tabId: null,
        windowId: null,
        favIconUrl: null
      });
    }
  }

  // 2. 搜索当前窗口的所有标签页，URL（不含参数和hash）需要同时包含所有关键词
  const tabMatches = [];
  for (const tab of tabs) {
    if (!tab.url) continue;

    const cleanUrl = getUrlWithoutParamsAndHash(tab.url);
    const cleanUrlLower = cleanUrl.toLowerCase();

    const matched = keywords.every((kw) => cleanUrlLower.includes(kw));

    if (matched) {
      // 检查是否和配置项重复（避免重复显示）
      const matchingConfig = configMatches.find((c) => {
        const normalizedConfig = normalizeUrl(c.url);
        const normalizedTab = normalizeUrl(cleanUrl);
        return normalizedTab.includes(normalizedConfig) || normalizedConfig.includes(normalizedTab);
      });

      if (matchingConfig) {
        // 如果配置项对应的网站已经在标签页中打开，更新配置项信息
        matchingConfig.tabId = tab.id;
        matchingConfig.windowId = tab.windowId;
        matchingConfig.favIconUrl = tab.favIconUrl;
        matchingConfig.title = tab.title || matchingConfig.title;
        matchingConfig.displayUrl = cleanUrl;
      } else {
        tabMatches.push({
          type: 'tab',
          url: cleanUrl,
          displayUrl: cleanUrl,
          title: tab.title || cleanUrl,
          tabId: tab.id,
          windowId: tab.windowId,
          favIconUrl: tab.favIconUrl
        });
      }
    }
  }

  // 3. 合并结果：配置项优先，然后是匹配的标签页
  results = [...configMatches, ...tabMatches];
  activeIndex = results.length > 0 ? 0 : -1;

  renderResults(keywords);
}

// ===== 渲染结果 =====
function renderResults(keywords) {
  if (results.length === 0) {
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="icon">😕</div>
        未找到匹配结果
      </div>`;
    return;
  }

  let html = '';
  let lastType = '';

  results.forEach((item, index) => {
    // 分组标题
    if (item.type !== lastType) {
      const label = item.type === 'config' ? '⭐ 配置匹配' : '📑 标签页匹配';
      html += `<div class="group-label">${label}</div>`;
      lastType = item.type;
    }

    const isActive = index === activeIndex ? 'active' : '';
    const badge = item.type === 'config'
      ? `<span class="badge config">${item.tabId ? '已打开' : '配置'}</span>`
      : '<span class="badge tab">标签页</span>';

    const defaultIcon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌐</text></svg>')}`;
    const favicon = item.favIconUrl
      ? `<img class="favicon" src="${escapeAttr(item.favIconUrl)}" onerror="this.src='${defaultIcon}'">`
      : `<img class="favicon" src="${defaultIcon}">`;

    const highlightedTitle = highlightMatch(item.title, keywords);
    const highlightedUrl = highlightMatch(item.displayUrl, keywords);

    html += `
      <div class="result-item ${isActive}" data-index="${index}">
        ${favicon}
        <div class="info">
          <div class="title">${highlightedTitle}</div>
          <div class="url">${highlightedUrl}</div>
        </div>
        ${badge}
      </div>`;
  });

  resultsList.innerHTML = html;
  bindResultEvents();
}

// ===== 绑定结果项事件 =====
function bindResultEvents() {
  resultsList.querySelectorAll('.result-item').forEach((el) => {
    el.addEventListener('click', () => {
      const index = parseInt(el.dataset.index);
      selectResult(results[index]);
    });
    el.addEventListener('mouseenter', () => {
      activeIndex = parseInt(el.dataset.index);
      updateActiveItem();
    });
  });
}

// ===== 更新高亮选中项 =====
function updateActiveItem() {
  const items = resultsList.querySelectorAll('.result-item');
  items.forEach((item, index) => {
    item.classList.toggle('active', index === activeIndex);
  });

  const activeItem = items[activeIndex];
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest' });
  }
}

// ===== 选中跳转 =====
async function selectResult(item) {
  if (item.tabId) {
    // 已在标签页中打开 → 切换到该标签页
    await chrome.tabs.update(item.tabId, { active: true });
    if (item.windowId) {
      await chrome.windows.update(item.windowId, { focused: true });
    }
    window.close();
  } else if (item.type === 'config') {
    // 配置的网站未打开 → 在新标签页中打开
    let url = item.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    await chrome.tabs.create({ url });
    window.close();
  }
}

// ===== 工具函数 =====

/**
 * 移除 URL 中的参数和 hash，只保留 origin + pathname
 */
function getUrlWithoutParamsAndHash(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * 规范化 URL，去除协议和末尾斜杠，用于比较
 */
function normalizeUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * 获取 storage 中保存的配置映射
 */
function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ mappings: {} }, (data) => {
      resolve(data.mappings);
    });
  });
}

/**
 * 高亮匹配的文本，支持多关键词
 * @param {string} text - 原始文本
 * @param {string[]} keywords - 关键词数组
 */
function highlightMatch(text, keywords) {
  if (!keywords || keywords.length === 0) return escapeHtml(text);

  const escaped = escapeHtml(text);
  // 将所有关键词合并为一个正则，用 | 分隔，按长度降序排列避免短词优先匹配
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = sortedKeywords.map((kw) => escapeRegex(escapeHtml(kw))).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  return escaped.replace(regex, '<span class="highlight">$1</span>');
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * 转义 HTML 属性值
 */
function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 防抖函数
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
