// 消息类型定义：Popup <-> Background <-> Content 的通信协议

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

/** 失败响应：返回错误信息 */
export interface PageContextError {
  ok: false;
  error: string;
}

export type PageContextResponse = PageContextResult | PageContextError;
