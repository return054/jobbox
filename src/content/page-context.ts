// 页面上下文采集
// 此文件导出的 collectPageContext 是一个纯函数，会被 background 通过
// chrome.scripting.executeScript({ func }) 序列化后注入到目标页面执行。
// 因此函数体只能使用页面环境可用的全局 API（document / location / window 等），
// 严禁引用外部模块变量或闭包变量，否则注入后会报 ReferenceError。

export interface PageContext {
  title: string;
  url: string;
  textSnippet: string;
}

/**
 * 在目标页面上下文中采集标题、URL 与正文片段。
 * 仅做最小采集，不做岗位识别（岗位识别在 Stage 2 的 ExtractorEngine 中完成）。
 */
export function collectPageContext(): PageContext {
  const title = (document.title || '').trim();
  const url = location.href;

  // 优先 innerText（保留可见文本结构），回退 textContent
  const body = document.body;
  const bodyText = body?.innerText || body?.textContent || '';
  // 取前 500 字作为片段，供后续提取与快速识别使用
  const textSnippet = bodyText.slice(0, 500).trim();

  return { title, url, textSnippet };
}
