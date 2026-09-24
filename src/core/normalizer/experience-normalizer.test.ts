import { describe, it, expect } from 'vitest';
import { normalizeExperience } from './experience-normalizer';

describe('normalizeExperience', () => {
  it('"5-10年" → {min:5, max:10}', () => {
    const r = normalizeExperience('5-10年');
    expect(r.min).toBe(5);
    expect(r.max).toBe(10);
    expect(r.parsed).toBe(true);
  });
  it('"3年以上" → min=3, max=0 (不限上限)', () => {
    const r = normalizeExperience('3年以上');
    expect(r.min).toBe(3);
    expect(r.max).toBe(0);
  });
  it('"3年以下" → min=0, max=3', () => {
    const r = normalizeExperience('3年以下');
    expect(r.min).toBe(0);
    expect(r.max).toBe(3);
  });
  it('"经验不限" → 0/0', () => {
    const r = normalizeExperience('经验不限');
    expect(r.min).toBe(0);
    expect(r.max).toBe(0);
    expect(r.parsed).toBe(true);
  });
  it('"应届生" → 0/0', () => {
    const r = normalizeExperience('应届生');
    expect(r.min).toBe(0);
    expect(r.max).toBe(0);
  });
  it('"3年" → min=max=3', () => {
    const r = normalizeExperience('3年');
    expect(r.min).toBe(3);
    expect(r.max).toBe(3);
  });
  it('空字符串 → parsed=false', () => {
    expect(normalizeExperience('').parsed).toBe(false);
  });
});
