// GenericAdapter 测试：JSON-LD / OG / 语义规则 / 异常
import { describe, it, expect } from 'vitest';
import { genericAdapter } from './generic-adapter';

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('genericAdapter.matches', () => {
  it('始终返回 true（兜底）', () => {
    expect(genericAdapter.matches('https://example.com/')).toBe(true);
    expect(genericAdapter.matches('https://www.zhipin.com/job_detail/x.html')).toBe(true);
  });
});

describe('genericAdapter.extract - JSON-LD JobPosting', () => {
  it('从 schema.org/JobPosting 提取 5 字段', () => {
    const ld = JSON.stringify({
      '@type': 'JobPosting',
      title: '前端工程师',
      description: '<p>负责前端开发</p>',
      hiringOrganization: { name: 'Acme 公司' },
      jobLocation: {
        address: {
          addressLocality: '杭州',
          addressRegion: '浙江',
        },
      },
      baseSalary: {
        currency: 'CNY',
        value: { minValue: 20, maxValue: 40, unitText: 'K' },
      },
    });
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">${ld}</script>
      </head><body><h1>ignored</h1></body></html>
    `);
    const raw = genericAdapter.extract(doc, 'https://example.com/job/1');
    expect(raw.title).toBe('前端工程师');
    expect(raw.company).toBe('Acme 公司');
    expect(raw.salary).toBe('20-40·K');
    expect(raw.location).toBe('杭州·浙江');
    // description 是 HTML，应转纯文本
    expect(raw.description).toBe('负责前端开发');
  });

  it('@type 数组形式仍识别为 JobPosting', () => {
    const ld = JSON.stringify({ '@type': ['JobPosting', 'Thing'], title: 'T' });
    const doc = makeDoc(`<html><head>
      <script type="application/ld+json">${ld}</script>
    </head><body></body></html>`);
    expect(genericAdapter.extract(doc, '').title).toBe('T');
  });

  it('非 JobPosting 的 JSON-LD 被忽略', () => {
    const ld = JSON.stringify({ '@type': 'Product', name: 'Not a job' });
    const doc = makeDoc(`<html><head>
      <script type="application/ld+json">${ld}</script>
    </head><body><h1>fallback</h1></body></html>`);
    const raw = genericAdapter.extract(doc, '');
    expect(raw.title).toBe('fallback');
  });
});

describe('genericAdapter.extract - Open Graph', () => {
  it('从 og:title / og:site_name / og:description 提取', () => {
    const doc = makeDoc(`
      <html><head>
        <meta property="og:title" content="OG 职位标题" />
        <meta property="og:site_name" content="OG 站点名" />
        <meta property="og:description" content="OG 描述内容" />
      </head><body></body></html>
    `);
    const raw = genericAdapter.extract(doc, 'https://example.com/job');
    expect(raw.title).toBe('OG 职位标题');
    expect(raw.company).toBe('OG 站点名');
    expect(raw.description).toBe('OG 描述内容');
  });

  it('回退到 name=description', () => {
    const doc = makeDoc(`
      <html><head>
        <meta name="description" content="meta description" />
      </head><body></body></html>
    `);
    const raw = genericAdapter.extract(doc, '');
    expect(raw.description).toBe('meta description');
  });
});

describe('genericAdapter.extract - 语义规则', () => {
  it('h1 作为 title，main 作为 description', () => {
    const doc = makeDoc(`
      <html><body>
        <h1>语义标题</h1>
        <main>段落一 段落二 段落三</main>
      </body></html>
    `);
    const raw = genericAdapter.extract(doc, '');
    expect(raw.title).toBe('语义标题');
    expect(raw.description).toContain('段落一');
  });

  it('h1 缺失时回退到 h2', () => {
    const doc = makeDoc(`<html><body><h2>h2 标题</h2></body></html>`);
    expect(genericAdapter.extract(doc, '').title).toBe('h2 标题');
  });
});

describe('genericAdapter.normalize', () => {
  it('折叠空白', () => {
    const raw = { title: '  多\n\n空\t白  ', company: '正\n常' };
    const out = genericAdapter.normalize(raw);
    expect(out.title).toBe('多 空 白');
    expect(out.company).toBe('正 常');
  });

  it('空字符串字段被丢弃', () => {
    const out = genericAdapter.normalize({ title: '   ', company: 'ok' });
    expect(out.title).toBeUndefined();
    expect(out.company).toBe('ok');
  });
});

describe('genericAdapter.extract - 异常页', () => {
  it('空白 body 返回空对象', () => {
    const doc = makeDoc(`<html><body></body></html>`);
    const raw = genericAdapter.extract(doc, '');
    expect(Object.keys(raw).length).toBe(0);
    expect(genericAdapter.confidence(raw)).toBe(0);
  });

  it('JSON-LD 语法错误被跳过', () => {
    const doc = makeDoc(`<html><head>
      <script type="application/ld+json">{bad json</script>
    </head><body><h1>ok</h1></body></html>`);
    const raw = genericAdapter.extract(doc, '');
    expect(raw.title).toBe('ok');
  });

  it('404 页只取到 h1', () => {
    const doc = makeDoc(`<html><body><h1>404 Not Found</h1></body></html>`);
    const raw = genericAdapter.extract(doc, '');
    expect(raw.title).toBe('404 Not Found');
    expect(raw.company).toBeUndefined();
    expect(raw.salary).toBeUndefined();
  });
});
