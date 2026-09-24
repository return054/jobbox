// 后台消息路由：接收 Popup 消息，调用相应能力并返回结果
import {
  MessageType,
  type IncomingMessage,
  type PageContextResponse,
} from './messages';
import { collectPageContext } from '../content/injector';

/**
 * 注册 chrome.runtime.onMessage 监听器，根据消息 type 分发处理。
 * 异步处理必须返回 true 以保持消息通道开启。
 */
export function registerMessageRouter(): void {
  chrome.runtime.onMessage.addListener(
    (message: IncomingMessage, _sender, sendResponse) => {
      if (!message || typeof (message as { type?: unknown }).type !== 'string') {
        return false;
      }

      switch (message.type) {
        case MessageType.GET_PAGE_CONTEXT:
          handleGetPageContext(sendResponse);
          return true;
        default:
          return false;
      }
    }
  );
}

/**
 * 获取当前活动标签页的页面上下文。
 * 依赖 activeTab + scripting 权限：用户点击 Popup 时获得该标签页的临时注入权限。
 */
async function handleGetPageContext(
  sendResponse: (response: PageContextResponse) => void
): Promise<void> {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab?.id) {
      sendResponse({ ok: false, error: '未找到活动标签页' });
      return;
    }

    // 浏览器内部页面 / 扩展商店禁止脚本注入
    const url = activeTab.url || '';
    if (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.includes('chrome.google.com/webstore') ||
      url.includes('microsoftedge.microsoft.com/addons')
    ) {
      sendResponse({ ok: false, error: '此页面不支持采集' });
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: collectPageContext,
    });

    const ctx = results?.[0]?.result;
    if (!ctx) {
      sendResponse({ ok: false, error: '页面上下文采集失败' });
      return;
    }

    sendResponse({
      ok: true,
      title: ctx.title,
      url: ctx.url,
      textSnippet: ctx.textSnippet,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[JobBox] getPageContext error:', err);
    sendResponse({ ok: false, error: `采集异常：${message}` });
  }
}
