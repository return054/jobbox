import { describe, it, expect } from 'vitest';
import { scoreJob } from './scoring';
import {
  normalizeSalary,
  normalizeLocation,
} from '../normalizer';

describe('scoreJob', () => {
  it('所有字段命中 → 100', () => {
    const s = scoreJob({
      title: '高级前端工程师',
      company: '字节跳动',
      salary: normalizeSalary('25-50K·14薪'),
      location: normalizeLocation('北京·朝阳区·望京'),
      description: 'x'.repeat(300),
    });
    expect(s.score).toBe(100);
    expect(s.reasons).toContain('title:20');
    expect(s.reasons).toContain('company:20');
    expect(s.reasons).toContain('salary:20');
    expect(s.reasons).toContain('location:15');
    expect(s.reasons).toContain('desc>=200:10');
  });

  it('仅 title+company+salary+loc+desc50 → 90', () => {
    const s = scoreJob({
      title: '前端',
      company: 'A公司',
      salary: normalizeSalary('5-8K'),
      location: normalizeLocation('杭州余杭区'),
      description: 'x'.repeat(50),
    });
    expect(s.score).toBe(90); // 20+20+20+15+15
  });

  it('只有 title → 20', () => {
    const s = scoreJob({ title: '前端' });
    expect(s.score).toBe(20);
  });

  it('空输入 → 0', () => {
    expect(scoreJob({}).score).toBe(0);
  });
});
