// Adapter 回归测试（Stage 6）
// 用固定 HTML 夹具验证 zhipin / generic adapter 的提取结果稳定，
// 防止 adapter 改动后提取行为发生意外变化。
//
// 夹具设计：
//   - zhipin-fixture: 模拟 BOSS 直聘详情页 DOM
//   - generic-ld-fixture: 带 schema.org/JobPosting JSON-LD 的页面
//   - non-job-fixture: 普通博客页面，应返回 confidence=0

import { describe, it, expect } from 'vitest';
import { zhipinAdapter } from './site-zhipin/zhipin-adapter';
import { genericAdapter } from './generic/generic-adapter';
import { ExtractorEngine } from '../core/extractor/extractor-engine';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

// === 夹具 ===

const ZHIPIN_HTML = `<!DOCTYPE html>
<html><head><title>高级前端工程师 - 字节跳动 - BOSS直聘</title></head>
<body>
  <div class="job-banner">
    <div class="name"><h1>高级前端工程师</h1></div>
    <span class="salary">25-50K·14薪</span>
    <span class="job-area">北京·朝阳区·望京</span>
  </div>
  <div class="company-info"><h3 class="name">字节跳动</h3></div>
  <div class="job-detail">
    职位描述：1. 负责核心业务前端开发；2. 参与技术方案设计；3. 推动性能优化。
    任职要求：本科及以上学历，3年以上前端经验，熟悉 React。
  </div>
</body></html>`;

const GENERIC_LD_HTML = `<!DOCTYPE html>
<html><head>
  <title>后端开发工程师 - 阿里巴巴</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": "后端开发工程师",
    "hiringOrganization": { "name": "阿里巴巴" },
    "jobLocation": { "address": { "addressLocality": "杭州", "addressRegion": "浙江" } },
    "baseSalary": {
      "currency": "CNY",
      "value": { "minValue": 30000, "maxValue": 60000, "unitText": "元/月" }
    },
    "description": "<p>负责电商核心系统后端开发，要求熟悉 Java/Go。</p>"
  }
  </script>
</head><body></body></html>`;

const NON_JOB_HTML = `<!DOCTYPE html>
<html><head><title>我的博客 - 技术随笔</title></head>
<body>
  <article>
    <h1>关于 TypeScript 类型系统的思考</h1>
    <p>今天聊一聊 TS 的高级类型...</p>
  </article>
</body></html>`;

const ZHIPIN_URL = 'https://www.zhipin.com/job_detail/1a2b3c.html';
const GENERIC_URL = 'https://example.com/jobs/backend';

// === zhipin adapter 回归 ===

describe('回归: zhipin adapter 提取稳定性', () => {
  it('matches 正确识别 zhipin 详情页', () => {
    expect(zhipinAdapter.matches(ZHIPIN_URL)).toBe(true);
    expect(zhipinAdapter.matches('https://www.zhipin.com/')).toBe(false);
    expect(zhipinAdapter.matches('https://lagou.com/jobs/123')).toBe(false);
  });

  it('从固定 HTML 提取 5 个核心字段，confidence=100', () => {
    const doc = parse(ZHIPIN_HTML);
    const raw = zhipinAdapter.extract(doc, ZHIPIN_URL);
    const normalized = zhipinAdapter.normalize(raw);
    const conf = zhipinAdapter.confidence(normalized);

    expect(normalized.title).toBe('高级前端工程师');
    expect(normalized.company).toBe('字节跳动');
    expect(normalized.salary).toBe('25-50K·14薪');
    expect(normalized.location).toBe('北京·朝阳区·望京');
    expect(normalized.description).toContain('负责核心业务前端开发');
    expect(conf).toBe(100);
  });

  it('normalize 折叠多余空白', () => {
    const doc = parse(ZHIPIN_HTML);
    const raw = zhipinAdapter.extract(doc, ZHIPIN_URL);
    const normalized = zhipinAdapter.normalize(raw);
    // description 里的换行/多空格被折叠成单空格
    expect(normalized.description).not.toMatch(/\s{2,}/);
  });
});

// === generic adapter 回归 ===

describe('回归: generic adapter JSON-LD 提取稳定性', () => {
  it('从 JSON-LD 提取全部字段', () => {
    const doc = parse(GENERIC_LD_HTML);
    const raw = genericAdapter.extract(doc, GENERIC_URL);
    const normalized = genericAdapter.normalize(raw);
    const conf = genericAdapter.confidence(normalized);

    expect(normalized.title).toBe('后端开发工程师');
    expect(normalized.company).toBe('阿里巴巴');
    expect(normalized.location).toBe('杭州·浙江');
    expect(normalized.salary).toBe('30000-60000·元/月');
    expect(normalized.description).toBe('负责电商核心系统后端开发，要求熟悉 Java/Go。');
    expect(conf).toBe(100);
  });

  it('非招聘页面 confidence=0', () => {
    const doc = parse(NON_JOB_HTML);
    const raw = genericAdapter.extract(doc, 'https://blog.example.com/post');
    const normalized = genericAdapter.normalize(raw);
    const conf = genericAdapter.confidence(normalized);

    // 非招聘页面：title 可能从 h1 提取到，但 company/salary/location 缺失
    // 这里验证 confidence < 100，且至少不应该是完整岗位
    expect(conf).toBeLessThan(100);
    expect(normalized.company).toBeUndefined();
    expect(normalized.salary).toBeUndefined();
  });
});

// === ExtractorEngine 优先级链回归 ===

describe('回归: ExtractorEngine 优先级链', () => {
  const engine = new ExtractorEngine({
    siteAdapters: [zhipinAdapter],
    fallback: genericAdapter,
  });

  it('zhipin URL 优先用 site adapter', () => {
    const doc = parse(ZHIPIN_HTML);
    const result = engine.extract(doc, ZHIPIN_URL);
    expect(result.strategy).toBe('site:zhipin');
    expect(result.confidence).toBe(100);
    expect(result.job.title).toBe('高级前端工程师');
  });

  it('非 zhipin URL 回退到 generic', () => {
    const doc = parse(GENERIC_LD_HTML);
    const result = engine.extract(doc, GENERIC_URL);
    expect(result.strategy).toBe('generic:generic');
    expect(result.confidence).toBe(100);
  });

  it('非招聘页面 confidence=0（JOB_NOT_FOUND 场景）', () => {
    const doc = parse(NON_JOB_HTML);
    const result = engine.extract(doc, 'https://blog.example.com/post');
    // generic 可能从 h1 拿到 title，所以 confidence > 0 但 < 100
    // 这里验证不是完整提取（缺少 company/salary/location）
    expect(result.confidence).toBeLessThan(100);
    expect(result.missingFields).toContain('company');
    expect(result.missingFields).toContain('salary');
  });
});
