import { describe, it, expect } from 'vitest';
import { validate } from './validator';
import {
  normalizeSalary,
  normalizeLocation,
} from '../normalizer';

describe('validate - 阈值判定', () => {
  it('score >= 90 → AUTO_PASS, valid=true', () => {
    const r = validate({
      title: '前端', company: '字节',
      salary: normalizeSalary('25-50K·14薪'),
      location: normalizeLocation('北京·朝阳区·望京'),
      description: 'x'.repeat(300),
    });
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.level).toBe('AUTO_PASS');
    expect(r.valid).toBe(true);
  });

  it('score 70-89 → NEED_REVIEW, valid=false', () => {
    // 没有 description: 20+20+20+15 = 75
    const r = validate({
      title: '前端', company: '字节',
      salary: normalizeSalary('5-8K'),
      location: normalizeLocation('杭州余杭区'),
    });
    expect(r.score).toBe(75);
    expect(r.level).toBe('NEED_REVIEW');
    expect(r.valid).toBe(false);
  });

  it('score < 70 → REJECT, valid=false', () => {
    // 只有 title = 20
    const r = validate({ title: '前端' });
    expect(r.score).toBe(20);
    expect(r.level).toBe('REJECT');
    expect(r.valid).toBe(false);
  });
});
