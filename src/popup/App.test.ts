// Popup App 纯函数单测
// 重点验证 Stage 2 的核心判定与构造逻辑：
//   1. hasJob：判定是否识别到岗位（至少有 title 或 company）
//   2. buildJobFromPartial：由 Partial<Job> + URL 补齐必填字段、推断 source
// 不依赖 React 运行时，避免引入 @testing-library/react

import { describe, it, expect } from 'vitest';
import { hasJob, buildJobFromPartial } from './App';
import type { Job } from '../types/job';

describe('hasJob', () => {
  it('undefined 返回 false', () => {
    expect(hasJob(undefined)).toBe(false);
  });

  it('空对象返回 false', () => {
    expect(hasJob({})).toBe(false);
  });

  it('只有 salary（无 title/company）返回 false', () => {
    expect(hasJob({ salary: '25-50K' })).toBe(false);
  });

  it('只有 title 返回 true', () => {
    expect(hasJob({ title: '前端工程师' })).toBe(true);
  });

  it('只有 company 返回 true', () => {
    expect(hasJob({ company: '字节跳动' })).toBe(true);
  });

  it('title+company 返回 true', () => {
    expect(hasJob({ title: '前端', company: '字节' })).toBe(true);
  });

  it('空字符串 title 不算识别', () => {
    expect(hasJob({ title: '   ', company: '' })).toBe(false);
  });
});

describe('buildJobFromPartial', () => {
  const FIXED_NOW = 1700000000000;

  it('补齐缺失的必填字段为空字符串', () => {
    const built = buildJobFromPartial({ title: '前端' }, 'https://example.com/job/1', FIXED_NOW);
    expect(built.title).toBe('前端');
    expect(built.company).toBe('');
    expect(built.salary).toBe('');
    expect(built.location).toBe('');
    expect(built.description).toBe('');
  });

  it('保留已有字段值（不覆盖）', () => {
    const partial: Partial<Job> = {
      title: '高级前端',
      company: '字节跳动',
      salary: '25-50K·14薪',
      location: '北京·朝阳区',
      description: '负责 Web 前端开发',
    };
    const built = buildJobFromPartial(partial, 'https://example.com/job/1', FIXED_NOW);
    expect(built).toMatchObject(partial);
  });

  it('zhipin.com URL 推断 source 为 zhipin', () => {
    const built = buildJobFromPartial(
      { title: '前端' },
      'https://www.zhipin.com/job_detail/abc.html',
      FIXED_NOW
    );
    expect(built.source).toBe('zhipin');
  });

  it('非 zhipin URL 推断 source 为 generic', () => {
    const built = buildJobFromPartial(
      { title: '前端' },
      'https://lagou.com/job/123',
      FIXED_NOW
    );
    expect(built.source).toBe('generic');
  });

  it('sourceUrl 与传入 URL 一致', () => {
    const url = 'https://www.zhipin.com/job_detail/x.html';
    const built = buildJobFromPartial({ title: '前端' }, url, FIXED_NOW);
    expect(built.sourceUrl).toBe(url);
  });

  it('fetchedAt 与传入 now 一致', () => {
    const built = buildJobFromPartial({ title: '前端' }, 'https://x.com/1', FIXED_NOW);
    expect(built.fetchedAt).toBe(FIXED_NOW);
  });

  it('返回对象满足 Job 必填字段类型', () => {
    const built = buildJobFromPartial({}, 'https://x.com/1', FIXED_NOW);
    // 所有必填字段均为 string 类型
    expect(typeof built.title).toBe('string');
    expect(typeof built.company).toBe('string');
    expect(typeof built.salary).toBe('string');
    expect(typeof built.location).toBe('string');
    expect(typeof built.description).toBe('string');
    expect(typeof built.sourceUrl).toBe('string');
    expect(typeof built.source).toBe('string');
    expect(typeof built.fetchedAt).toBe('number');
  });
});
