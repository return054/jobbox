import { describe, it, expect } from 'vitest';
import { normalizeLocation } from './location-normalizer';

describe('normalizeLocation', () => {
  it('验收 case: "杭州余杭区" → {province:浙江, city:杭州, district:余杭区}', () => {
    const r = normalizeLocation('杭州余杭区');
    expect(r.province).toBe('浙江');
    expect(r.city).toBe('杭州');
    expect(r.district).toBe('余杭区');
    expect(r.parsed).toBe(true);
  });

  it('"北京·朝阳区·望京" → 直辖市 province=city，district=朝阳区', () => {
    const r = normalizeLocation('北京·朝阳区·望京');
    expect(r.province).toBe('北京');
    expect(r.city).toBe('北京');
    expect(r.district).toBe('朝阳区');
  });

  it('"广州天河区" → 广东/广州/天河区', () => {
    const r = normalizeLocation('广州天河区');
    expect(r.province).toBe('广东');
    expect(r.city).toBe('广州');
    expect(r.district).toBe('天河区');
  });

  it('"上海" → 直辖市 district 为空', () => {
    const r = normalizeLocation('上海');
    expect(r.province).toBe('上海');
    expect(r.city).toBe('上海');
    expect(r.district).toBe('');
  });

  it('未知城市 → city=raw, parsed=false', () => {
    const r = normalizeLocation('某未知城市');
    expect(r.parsed).toBe(false);
    expect(r.city).toBe('某未知城市');
  });

  it('空字符串 → parsed=false', () => {
    expect(normalizeLocation('').parsed).toBe(false);
  });
});
