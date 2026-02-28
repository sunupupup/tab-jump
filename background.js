// Tab Jump - Background Service Worker

// 扩展安装时初始化默认配置
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      mappings: {}
    });
    // 安装后打开配置页，引导用户设置
    chrome.runtime.openOptionsPage();
  }
});
