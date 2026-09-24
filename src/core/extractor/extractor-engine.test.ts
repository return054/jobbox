// ExtractorEngine 调度测试：站点命中优先、回退、策略路径
import { describe, it, expect } from 'vitest';
import { ExtractorEngine } from './extractor-engine';
import { zhipinAdapter } from '../../adapters/site-zhipin/zhipin-adapter';
import { genericAdapter } from '../../adapters/generic/generic-adapter';

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('ExtractorEngine.extract - 站点命中', () => {
  const engine = new ExtractorEngine({
    siteAdapters: [zhipinAdapter],
    fallback: genericAdapter,
  });

  it('zhipin.com 岗位详情页走 site:zhipin 策略', () => {
    const doc = makeDoc(`
      <html><body>
        <div class="job-banner">
          <div class="name"><h1>前端</h1></div>
          <span class="salary">20K</span>
          <span class="job-area">北京</span>
        </div>
        <div class="company-info"><span class="name">某公司</span></div>
        <div class="job-detail">描述</div>
      </body></html>
    `);
    const result = engine.extract(doc, 'https://www.zhipin.com/job_detail/abc.html');
    expect(result.strategy).toBe('site:zhipin');
    expect(result.confidence).toBe(100);
    expect(result.missingFields).toEqual([]);
    expect(result.job.title).toBe('前端');
    expect(result.job.source).toBe('zhipin');
    expect(result.job.sourceUrl).toBe('https://www.zhipin.com/job_detail/abc.html');
  });
});

describe('ExtractorEngine.extract - 回退 generic', () => {
  const engine = new ExtractorEngine({
    siteAdapters: [zhipinAdapter],
    fallback: genericAdapter,
  });

  it('未知站点回退到 generic:generic', () => {
    const ld = JSON.stringify({
      '@type': 'JobPosting',
      title: 'OG 职位',
      hiringOrganization: { name: '某公司' },
    });
    const doc = makeDoc(`<html><head>
      <script type="application/ld+json">${ld}</script>
    </head><body></body></html>`);
    const result = engine.extract(doc, 'https://example.com/job/1');
    expect(result.strategy).toBe('generic:generic');
    expect(result.job.title).toBe('OG 职位');
    expect(result.job.source).toBe('generic');
  });

  it('zhipin 列表页（非 /job_detail/）走 generic', () => {
    const doc = makeDoc(`<html><body><h1>职位列表</h1></body></html>`);
    const result = engine.extract(doc, 'https://www.zhipin.com/web/geek/job');
    expect(result.strategy).toBe('generic:generic');
  });
});

describe('ExtractorEngine.extract - 站点失败也回退', () => {
  const engine = new ExtractorEngine({
    siteAdapters: [zhipinAdapter],
    fallback: genericAdapter,
  });

  it('zhipin URL 但 DOM 不匹配，站点 confidence=0 则回退', () => {
    // zhipin 适配器在异常页提取不到任何字段，confidence=0
    // 引擎会继续尝试 fallback
    const ld = JSON.stringify({ '@type': 'JobPosting', title: '从 JSON-LD 救回' });
    const doc = makeDoc(`<html><head>
      <script type="application/ld+json">${ld}</script>
    </head><body></body></html>`);
    const result = engine.extract(doc, 'https://www.zhipin.com/job_detail/abc.html');
    // site:zhipin confidence=0，回退到 generic
    expect(result.strategy).toBe('generic:generic');
    expect(result.job.title).toBe('从 JSON-LD 救回');
  });
});

describe('ExtractorEngine.extract - 异常页', () => {
  const engine = new ExtractorEngine({
    siteAdapters: [zhipinAdapter],
    fallback: genericAdapter,
  });

  it('完全无关页面 confidence=0 但不抛错', () => {
    const doc = makeDoc(`<html><body><h1>404</h1></body></html>`);
    const result = engine.extract(doc, 'https://example.com/');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.job).toBeDefined();
  });
});
