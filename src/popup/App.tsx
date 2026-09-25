import { useEffect, useState } from 'react';
import { MessageType, type PageContextResponse } from '../messaging/messages';
import { jobRepository } from '../storage';

// Stage 1: 显示当前页面上下文（title / URL / 文本片段）
// 岗位识别（Stage 2）尚未接入，因此状态常驻「暂未识别到招聘详情页」
// Stage 5: 增加「打开岗位库」入口 + 已保存岗位数

interface PageInfo {
  title: string;
  url: string;
  textSnippet: string;
}

export default function App() {
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    chrome.runtime.sendMessage(
      { type: MessageType.GET_PAGE_CONTEXT },
      (response: PageContextResponse | undefined) => {
        if (cancelled) return;
        setLoading(false);

        // 监听 chrome.runtime.lastError 避免未检查告警
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          setError(lastErr.message || '通信失败');
          return;
        }

        if (!response) {
          setError('无响应');
          return;
        }

        if (response.ok) {
          setPageInfo({
            title: response.title,
            url: response.url,
            textSnippet: response.textSnippet,
          });
        } else {
          setError(response.error);
        }
      }
    );

    // 读取已保存岗位数
    jobRepository.count().then((n) => {
      if (!cancelled) setSavedCount(n);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">JobBox</h1>
        <p className="subtitle">招聘岗位助手</p>
      </header>

      <main className="main">
        <p className="status status--idle">暂未识别到招聘详情页</p>

        {loading && <p className="page-info page-info--hint">正在读取当前页面…</p>}

        {error && !loading && (
          <p className="page-info page-info--error">{error}</p>
        )}

        {pageInfo && !loading && (
          <section className="page-info">
            <div className="page-info__row">
              <span className="page-info__label">标题</span>
              <span className="page-info__value page-info__title">
                {pageInfo.title || '(无标题)'}
              </span>
            </div>
            <div className="page-info__row">
              <span className="page-info__label">地址</span>
              <span className="page-info__value page-info__url" title={pageInfo.url}>
                {pageInfo.url}
              </span>
            </div>
            <div className="page-info__row">
              <span className="page-info__label">片段</span>
              <span className="page-info__value page-info__snippet">
                {pageInfo.textSnippet || '(空)'}
              </span>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>已保存：{savedCount} 个岗位</span>
        <button className="footer__btn" onClick={openDashboard}>
          打开岗位库
        </button>
      </footer>
    </div>
  );
}
