// scripting 注入入口
// 将页面上下文采集函数暴露给 background，供 chrome.scripting.executeScript 使用。
// Vite 会把 page-context 的函数体内联进 background.js，
// executeScript 序列化 func.toString() 后注入页面执行。

export { collectPageContext, type PageContext } from './page-context';
