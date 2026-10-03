import { useEffect, useState } from 'react';
import { MessageType, type PageContextResponse } from '../messaging/messages';
import { jobRepository } from '../storage';
import type { Job } from '../types/job';

// Stage 2: Popup 接入 adapter 引擎后，直接渲染从页面提取的岗位字段
// 当 ctx.job 含 title 或 company 时，渲染岗位卡片 + 保存按钮
// 否则回退到 Stage 1 的页面上下文展示（暂未识别到招聘详情页）
// Stage 5: 保留「打开岗位库」入口 + 已保存岗位数

interface PageInfo {
  title: string;
  url: string;
  textSnippet: string;
  job?: Partial<Job>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 判断是否识别到岗位：至少有 title 或 company（去除空白后非空）
 * 导出便于单测，不依赖 React 运行时
 * 虽 page-context 已清理空白字段，这里仍防御性 trim 以兼容直接调用场景
 */
export function hasJob(partial?: Partial<Job>): boolean {
  if (!partial) return false;
  const t = partial.title?.trim();
  const c = partial.company?.trim();
  return !!(t || c);
}

/**
 * 由 Partial<Job> + 页面 URL 构造完整 Job：补齐缺失的必填字段
 * source 由 URL 域名推断（zhipin.com → 'zhipin'，其余 → 'generic'）
 * fetchedAt 缺省时用 Date.now() 兜底
 */
export function buildJobFromPartial(
  partial: Partial<Job>,
  url: string,
  now: number = Date.now()
): Job {
  return {
    title: partial.title ?? '',
    company: partial.company ?? '',
    salary: partial.salary ?? '',
    location: partial.location ?? '',
    description: partial.description ?? '',
    sourceUrl: url,
    source: url.includes('zhipin.com') ? 'zhipin' : 'generic',
    fetchedAt: now,
  };
}

export default function App() {
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');

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
            job: response.job,
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

  // 判断是否识别到岗位：至少有 title 或 company
  const partial = pageInfo?.job;
  const identified = hasJob(partial);

  const handleSave = async () => {
    if (!pageInfo || !partial) return;
    const built = buildJobFromPartial(partial, pageInfo.url);
    setSaveState('saving');
    try {
      await jobRepository.save(built);
      setSaveState('saved');
      setSavedCount((n) => n + 1);
    } catch {
      setSaveState('error');
    }
  };

  const saveBtnText =
    saveState === 'saving'
      ? '保存中…'
      : saveState === 'saved'
      ? '已保存'
      : saveState === 'error'
      ? '保存失败，重试'
      : '保存岗位';

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">JobBox</h1>
        <p className="subtitle">招聘岗位助手</p>
      </header>

      <main className="main">
        {loading && <p className="page-info page-info--hint">正在读取当前页面…</p>}

        {error && !loading && (
          <p className="page-info page-info--error">{error}</p>
        )}

        {pageInfo && !loading && identified && partial && (
          <section className="job-card">
            {partial.title && <div className="job-card__title">{partial.title}</div>}
            {partial.company && (
              <div className="job-card__company">{partial.company}</div>
            )}
            <div className="job-card__meta">
              {partial.salary && (
                <span className="job-card__salary">{partial.salary}</span>
              )}
              {partial.location && (
                <span className="job-card__location">{partial.location}</span>
              )}
            </div>
            {partial.description && (
              <div className="job-card__desc">{partial.description}</div>
            )}
            <button
              className="job-card__save-btn"
              onClick={handleSave}
              disabled={saveState === 'saving' || saveState === 'saved'}
            >
              {saveBtnText}
            </button>
          </section>
        )}

        {pageInfo && !loading && !identified && (
          <>
            <p className="status status--idle">暂未识别到招聘详情页</p>
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
          </>
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
