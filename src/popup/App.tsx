import { useState } from 'react';

// Stage 0: 最小可用 Popup
// - 显示品牌与状态
// - 后续 Stage 1 会接入当前页面识别
export default function App() {
  const [savedCount] = useState(0);

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">JobBox</h1>
        <p className="subtitle">招聘岗位助手</p>
      </header>

      <main className="main">
        <p className="status status--idle">暂未识别到招聘详情页</p>
      </main>

      <footer className="footer">
        <span>已保存：{savedCount} 个岗位</span>
      </footer>
    </div>
  );
}
