// BOSS 直聘适配器测试：正常 / 缺失 / 异常 三种页面场景
import { describe, it, expect, beforeEach } from 'vitest';
import { zhipinAdapter } from './zhipin-adapter';

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('zhipinAdapter.matches', () => {
  it('匹配 BOSS 直聘岗位详情页', () => {
    expect(zhipinAdapter.matches('https://www.zhipin.com/job_detail/abc123.html')).toBe(true);
    expect(zhipinAdapter.matches('https://zhipin.com/job_detail/X.html')).toBe(true);
  });

  it('不匹配非直聘页或列表页', () => {
    expect(zhipinAdapter.matches('https://www.zhipin.com/web/geek/job?query=前端')).toBe(false);
    expect(zhipinAdapter.matches('https://www.lagou.com/wn/')).toBe(false);
    expect(zhipinAdapter.matches('https://example.com/')).toBe(false);
  });
});

describe('zhipinAdapter.extract - 正常页', () => {
  let doc: Document;
  beforeEach(() => {
    doc = makeDoc(`
      <html>
        <body>
          <div class="job-banner">
            <div class="name"><h1>高级前端工程师</h1></div>
            <span class="salary">25-50K·14薪</span>
            <span class="job-area">北京·朝阳区·望京</span>
          </div>
          <div class="company-info"><span class="name">字节跳动</span></div>
          <div class="job-detail">
            岗位职责：负责前端架构设计与实现。任职要求：5 年前端经验，熟练 React。
          </div>
        </body>
      </html>
    `);
  });

  it('提取全部 5 字段', () => {
    const raw = zhipinAdapter.extract(doc, 'https://www.zhipin.com/job_detail/abc.html');
    expect(raw.title).toBe('高级前端工程师');
    expect(raw.salary).toBe('25-50K·14薪');
    expect(raw.location).toBe('北京·朝阳区·望京');
    expect(raw.company).toBe('字节跳动');
    expect(raw.description).toContain('岗位职责');
    expect(raw.description).toContain('任职要求');
  });

  it('normalize 折叠空白', () => {
    const doc2 = makeDoc(`
      <html><body>
        <div class="job-banner"><div class="name"><h1>  高级
          前端  </h1></div></div>
      </body></html>
    `);
    const raw = zhipinAdapter.extract(doc2, '');
    const norm = zhipinAdapter.normalize(raw);
    expect(norm.title).toBe('高级 前端');
  });

  it('confidence 满分 100', () => {
    const raw = zhipinAdapter.extract(doc, 'https://www.zhipin.com/job_detail/abc.html');
    expect(zhipinAdapter.confidence(raw)).toBe(100);
  });
});

describe('zhipinAdapter.extract - 缺失页', () => {
  it('只命中部分字段', () => {
    const doc = makeDoc(`
      <html><body>
        <div class="job-banner">
          <div class="name"><h1>前端工程师</h1></div>
          <span class="salary">15-25K</span>
        </div>
        <div class="job-detail">负责前端开发。</div>
      </body></html>
    `);
    const raw = zhipinAdapter.extract(doc, 'https://www.zhipin.com/job_detail/x.html');
    expect(raw.title).toBe('前端工程师');
    expect(raw.salary).toBe('15-25K');
    expect(raw.description).toBe('负责前端开发。');
    expect(raw.company).toBeUndefined();
    expect(raw.location).toBeUndefined();
  });

  it('confidence 部分字段时 < 100', () => {
    const doc = makeDoc(`<html><body>
      <div class="job-banner"><div class="name"><h1>前端</h1></div></div>
    </body></html>`);
    const raw = zhipinAdapter.extract(doc, '');
    expect(zhipinAdapter.confidence(raw)).toBe(20);
  });
});

describe('zhipinAdapter.extract - 异常页', () => {
  it('完全无关页面应返回空对象', () => {
    const doc = makeDoc(`<html><body><h1>404 Not Found</h1></body></html>`);
    const raw = zhipinAdapter.extract(doc, 'https://www.zhipin.com/job_detail/abc.html');
    expect(raw.title).toBeUndefined();
    expect(raw.company).toBeUndefined();
    expect(raw.salary).toBeUndefined();
    expect(raw.location).toBeUndefined();
    expect(raw.description).toBeUndefined();
  });

  it('空白 body', () => {
    const doc = makeDoc(`<html><body></body></html>`);
    const raw = zhipinAdapter.extract(doc, 'https://www.zhipin.com/job_detail/x.html');
    expect(zhipinAdapter.confidence(raw)).toBe(0);
  });

  it('null/undefined 字段不会被包装成字符串', () => {
    const doc = makeDoc(`<html><body><p>no job here</p></body></html>`);
    const raw = zhipinAdapter.extract(doc, '');
    expect(Object.keys(raw).length).toBe(0);
  });
});
