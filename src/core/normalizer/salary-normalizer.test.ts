import { describe, it, expect } from 'vitest';
import { normalizeSalary } from './salary-normalizer';

describe('normalizeSalary', () => {
  it('验收 case: "5-8K·13薪" → {min:5000, max:8000, unit:MONTH, months:13}', () => {
    const r = normalizeSalary('5-8K·13薪');
    expect(r.min).toBe(5000);
    expect(r.max).toBe(8000);
    expect(r.unit).toBe('MONTH');
    expect(r.months).toBe(13);
    expect(r.parsed).toBe(true);
  });

  it('"25-50K·14薪" → {min:25000, max:50000, months:14}', () => {
    const r = normalizeSalary('25-50K·14薪');
    expect(r.min).toBe(25000);
    expect(r.max).toBe(50000);
    expect(r.months).toBe(14);
    expect(r.unit).toBe('MONTH');
  });

  it('"10-15K/月" → 月薪 + months=12', () => {
    const r = normalizeSalary('10-15K/月');
    expect(r.min).toBe(10000);
    expect(r.max).toBe(15000);
    expect(r.months).toBe(12);
    expect(r.unit).toBe('MONTH');
  });

  it('"15-30W" → 万元单位', () => {
    const r = normalizeSalary('15-30W');
    expect(r.min).toBe(150000);
    expect(r.max).toBe(300000);
  });

  it('"8000-12000" → 纯数字按元处理', () => {
    const r = normalizeSalary('8000-12000');
    expect(r.min).toBe(8000);
    expect(r.max).toBe(12000);
    expect(r.months).toBe(12);
  });

  it('"面议" → parsed=false', () => {
    const r = normalizeSalary('面议');
    expect(r.parsed).toBe(false);
    expect(r.min).toBe(0);
  });

  it('空字符串 → parsed=false', () => {
    expect(normalizeSalary('').parsed).toBe(false);
  });
});
