// 消息类型定义：Popup <-> Background <-> Content 的通信协议
// Stage 6: 失败响应携带 JobBoxErrorCode，便于前端展示对应提示

import type { JobBoxErrorCode } from '../types/errors';

export const MessageType = {
  GET_PAGE_CONTEXT: 'GET_PAGE_CONTEXT',
} as const;

export interface GetPageContextMessage {
  type: typeof MessageType.GET_PAGE_CONTEXT;
}

export type IncomingMessage = GetPageContextMessage;

/** 成功响应：返回当前页面上下文 */
export interface PageContextResult {
  ok: true;
  title: string;
  url: string;
  textSnippet: string;
}

/** 失败响应：返回错误信息 + 错误码 */
export interface PageContextError {
  ok: false;
  error: string;
  /** Stage 6: 结构化错误码，前端可据此展示精确提示 */
  code?: JobBoxErrorCode;
}

export type PageContextResponse = PageContextResult | PageContextError;
