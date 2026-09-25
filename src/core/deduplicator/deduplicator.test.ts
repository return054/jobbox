import { describe, it, expect } from 'vitest';
import {
  canonicalUrlOf,
  fingerprintOf,
  isDuplicate,
} from './deduplicator';
import {
  normalizeSalary,
  normalizeLocation,
  type NormalizedJob,
} from '../normalizer';

describe('canonicalUrlOf', () => {
  it('验收 case: /job/123 与 /job/123?source=xxx → 同一 canonical URL', () => {
    const a = canonicalUrlOf('https://x.com/job/123');
    const b = canonicalUrlOf('https://x.com/job/123?source=xxx');
    expect(a).toBe(b);
  });

  it('路径不同 → 不同 canonical URL', () => {
    expect(canonicalUrlOf('https://x.com/job/123')).not.toBe(
      canonicalUrlOf('https://x.com/job/456')
    );
  });
});

describe('fingerprintOf', () => {
  it('同 title+company+city+salary → 同 fingerprint', () => {
    const job = { title: '前端', company: '字节' };
    const normalized: Partial<NormalizedJob> = {
      salary: normalizeSalary('25-50K'),
      location: normalizeLocation('北京·朝阳区'),
    };
    const fp1 = fingerprintOf(job, normalized);
    const fp2 = fingerprintOf({ ...job }, { ...normalized });
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(0);
  });

  it('title 不同 → fingerprint 不同', () => {
    const base = { company: '字节' };
    expect(fingerprintOf({ ...base, title: 'A' })).not.toBe(
      fingerprintOf({ ...base, title: 'B' })
    );
  });

  it('city 不同 → fingerprint 不同', () => {
    const job = { title: '前端', company: '字节' };
    const a = fingerprintOf(job, {
      location: normalizeLocation('北京'),
    });
    const b = fingerprintOf(job, {
      location: normalizeLocation('上海'),
    });
    expect(a).not.toBe(b);
  });
});

describe('isDuplicate', () => {
  it('验收 case: /job/123 与 /job/123?source=xxx → isDuplicate=true (canonical_url)', () => {
    const a = { url: 'https://x.com/job/123', job: { title: 'A' } };
    const b = {
      url: 'https://x.com/job/123?source=xxx',
      job: { title: 'A' },
    };
    const r = isDuplicate(a, b);
    expect(r.isDuplicate).toBe(true);
    expect(r.reason).toBe('canonical_url');
  });

  it('不同 URL 但同 title+company+city+salary → fingerprint 命中', () => {
    const job = { title: '前端', company: '字节' };
    const normalized: Partial<NormalizedJob> = {
      salary: normalizeSalary('25-50K'),
      location: normalizeLocation('北京'),
    };
    const a = { url: 'https://a.com/1', job, normalized };
    const b = { url: 'https://b.com/2', job, normalized };
    const r = isDuplicate(a, b);
    expect(r.isDuplicate).toBe(true);
    expect(r.reason).toBe('fingerprint');
  });

  it('完全不同 → isDuplicate=false', () => {
    const a = {
      url: 'https://a.com/1',
      job: { title: 'A', company: 'X' },
    };
    const b = {
      url: 'https://b.com/2',
      job: { title: 'B', company: 'Y' },
    };
    expect(isDuplicate(a, b).isDuplicate).toBe(false);
  });
});
