// 性能测试（Stage 6）
// 验收标准：
//   - 提取 <= 2s
//   - 保存 <= 500ms（单条 + 批量 1000 条）
//   - 搜索 1000 条无明显卡顿

import { describe, it, expect } from 'vitest';
import { ExtractorEngine } from './extractor-engine';
import { zhipinAdapter } from '../../adapters/site-zhipin/zhipin-adapter';
import { genericAdapter } from '../../adapters/generic/generic-adapter';
import { MemoryStorage } from '../../storage/storage-adapter';
import { JobRepository } from '../../storage/job-repository';
import type { Job } from '../../types/job';

/** 生成一个模拟真实招聘页的大 HTML（~100KB），测提取耗时 */
function makeLargeJobHtml(): string {
  const noise = Array.from({ length: 500 }, () => '<p>无关内容段落，用于模拟页面噪声。</p>').join('');
  return `<!DOCTYPE html><html><head><title>测试</title></head><body>
    ${noise}
    <div class="job-banner">
      <div class="name"><h1>高级前端工程师</h1></div>
      <span class="salary">25-50K·14薪</span>
      <span class="job-area">北京·朝阳区·望京</span>
    </div>
    <div class="company-info"><h3 class="name">字节跳动</h3></div>
    <div class="job-detail">负责核心业务前端开发，参与技术方案设计，推动性能优化。要求本科以上学历，3年以上经验。</div>
    ${noise}
  </body></html>`;
}

function makeJob(i: number): Job {
  return {
    title: `岗位-${i}`,
    company: `公司-${i}`,
    salary: '20-40K',
    location: '北京',
    description: '描述内容',
    sourceUrl: `https://x.com/${i}`,
    source: 'zhipin',
    fetchedAt: Date.now() + i,
  };
}

describe('性能: 提取耗时', () => {
  const engine = new ExtractorEngine({
    siteAdapters: [zhipinAdapter],
    fallback: genericAdapter,
  });

  it('提取 <= 2s（大 HTML 页面）', () => {
    const html = makeLargeJobHtml();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const url = 'https://www.zhipin.com/job_detail/test.html';

    const start = performance.now();
    const result = engine.extract(doc, url);
    const elapsed = performance.now() - start;

    expect(result.confidence).toBe(100);
    expect(elapsed).toBeLessThan(2000);
  });

  it('连续提取 100 次平均 <= 50ms', () => {
    const html = makeLargeJobHtml();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const url = 'https://www.zhipin.com/job_detail/test.html';

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      engine.extract(doc, url);
    }
    const elapsed = performance.now() - start;

    expect(elapsed / 100).toBeLessThan(50);
  });
});

describe('性能: 保存耗时', () => {
  it('单条 save <= 500ms', async () => {
    const repo = new JobRepository(new MemoryStorage());
    const job = makeJob(1);
    const start = performance.now();
    await repo.save(job);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(await repo.count()).toBe(1);
  });

  it('批量 saveAll(1000) <= 500ms', async () => {
    const repo = new JobRepository(new MemoryStorage());
    const jobs = Array.from({ length: 1000 }, (_, i) => makeJob(i));
    const start = performance.now();
    await repo.saveAll(jobs);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(await repo.count()).toBe(1000);
  });
});

describe('性能: 1000 条搜索', () => {
  it('搜索 <= 200ms', async () => {
    const repo = new JobRepository(new MemoryStorage());
    const jobs = Array.from({ length: 1000 }, (_, i) => makeJob(i));
    await repo.saveAll(jobs);

    const start = performance.now();
    const r = await repo.search({ keyword: '岗位', limit: 50 });
    const elapsed = performance.now() - start;

    expect(r.length).toBeLessThanOrEqual(50);
    expect(elapsed).toBeLessThan(200);
  });
});
