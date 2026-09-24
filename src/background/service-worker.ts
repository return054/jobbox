// JobBox Service Worker (MV3)
// 事件驱动的后台协调器：负责扩展生命周期、消息路由、Tab 协调
// 注意：Service Worker 没有 DOM，网页解析必须由 content script 完成

import { registerMessageRouter } from '../messaging/message-router';

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[JobBox] installed:', details.reason);
});

// 注册消息路由：处理 Popup 发来的请求（如获取当前页面上下文）
registerMessageRouter();
