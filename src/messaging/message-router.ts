// 后台消息路由：接收 Popup 消息，调用相应能力并返回结果
// Stage 6: 所有错误包装为 JobBoxError，响应携带 code；关键路径打 INFO/WARN 日志
import {
  MessageType,
  type IncomingMessage,
  type PageContextResponse,
} from './messages';
import { collectPageContext } from '../content/injector';
import { JobBoxError, JobBoxErrorCode } from '../types/errors';
import { createLogger } from '../utils/logger';

const log = createLogger('router');

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
  const start = performance.now();
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab?.id) {
      const e = new JobBoxError(JobBoxErrorCode.PAGE_NOT_SUPPORTED, '未找到活动标签页');
      log.warn('无活动标签页');
      sendResponse({ ok: false, error: e.message, code: e.code });
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
      log.warn('页面不支持采集', { url });
      sendResponse({
        ok: false,
        error: '此页面不支持采集',
        code: JobBoxErrorCode.PAGE_NOT_SUPPORTED,
      });
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: collectPageContext,
    });

    const ctx = results?.[0]?.result;
    if (!ctx) {
      log.warn('页面上下文采集失败', { url });
      sendResponse({
        ok: false,
        error: '页面上下文采集失败',
        code: JobBoxErrorCode.JOB_NOT_FOUND,
      });
      return;
    }

    const jobFields = ctx.job ? Object.keys(ctx.job).length : 0;
    log.info('页面上下文采集成功', {
      url: ctx.url,
      title: ctx.title,
      jobFields,
      elapsedMs: Math.round(performance.now() - start),
    });

    sendResponse({
      ok: true,
      title: ctx.title,
      url: ctx.url,
      textSnippet: ctx.textSnippet,
      job: ctx.job,
    });
  } catch (err) {
    const jbErr = JobBoxError.from(err);
    log.warn('采集异常', { code: jbErr.code, message: jbErr.message });
    sendResponse({ ok: false, error: `采集异常：${jbErr.message}`, code: jbErr.code });
  }
}
