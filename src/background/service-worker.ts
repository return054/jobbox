// JobBox Service Worker (MV3)
// 事件驱动的后台协调器：负责扩展生命周期、消息协调、Tab 协调
// 注意：Service Worker 没有 DOM，网页解析必须由 content script 完成

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[JobBox] installed:', details.reason);
});

// 监听来自 popup / content 的消息（Stage 1 起扩展）
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  console.log('[JobBox] message:', message);
  return false;
});
