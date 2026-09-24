import { describe, it, expect } from 'vitest';
import { canonicalizeUrl } from './url';

describe('canonicalizeUrl', () => {
  it('验收 case: /job/123 与 /job/123?source=xxx 判定为同一 URL', () => {
    const a = canonicalizeUrl('https://example.com/job/123');
    const b = canonicalizeUrl('https://example.com/job/123?source=xxx');
    expect(a).toBe(b);
    expect(a).toBe('https://example.com/job/123');
  });

  it('去除 utm_* 与多种 tracking 参数', () => {
    const a = canonicalizeUrl('https://example.com/job/456');
    const b = canonicalizeUrl(
      'https://example.com/job/456?utm_source=bing&from=ad&ref=xx&spm=123&custom=keep'
    );
    expect(a).not.toBe(b); // custom=keep 被保留 → 不应判同
    expect(b).toContain('custom=keep');
    expect(b).not.toContain('utm_');
    expect(b).not.toContain('source');
    expect(b).not.toContain('from=');
  });

  it('剩余参数按字母序排序，顺序不同也判同', () => {
    const a = canonicalizeUrl('https://x.com/p?b=2&a=1');
    const b = canonicalizeUrl('https://x.com/p?a=1&b=2');
    expect(a).toBe(b);
  });

  it('hash 保留（SPA 把 id 放 hash 时不破坏去重）', () => {
    const a = canonicalizeUrl('https://x.com/#/job/100');
    const b = canonicalizeUrl('https://x.com/?source=ad#/job/100');
    expect(a).toBe(b);
  });

  it('空 / 非法 URL 兜底原样返回', () => {
    expect(canonicalizeUrl('')).toBe('');
    // 非法 URL 直接 trim 返回
    expect(canonicalizeUrl('  not-a-url  ')).toBe('not-a-url');
  });
});
