import { describe, it, expect } from 'vitest';
import { normalizeEducation } from './education-normalizer';

describe('normalizeEducation', () => {
  it('"本科" → 本科', () => {
    expect(normalizeEducation('本科').level).toBe('本科');
  });
  it('"硕士及以上" → 硕士（从高到低先匹配）', () => {
    expect(normalizeEducation('硕士及以上').level).toBe('硕士');
  });
  it('"大专或本科" → 硕士（不命中）/ 实际命中 本科', () => {
    // 硕士 不出现，本科 出现 → 本科
    expect(normalizeEducation('大专或本科').level).toBe('本科');
  });
  it('"学历不限" → 不限', () => {
    expect(normalizeEducation('学历不限').level).toBe('不限');
  });
  it('"无要求" → 不限', () => {
    expect(normalizeEducation('无要求').level).toBe('不限');
  });
  it('空字符串 → parsed=false', () => {
    expect(normalizeEducation('').parsed).toBe(false);
  });
});
