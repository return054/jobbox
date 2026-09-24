// BOSS 直聘（zhipin.com）适配器
// 页面 URL: https://www.zhipin.com/job_detail/{id}.html
// DOM 结构基于 2024-2025 观察到的稳定类名，会随平台改版变动；
// 适配器只做"读取"，字段命中失败时由 ExtractorEngine 回退到 GenericAdapter。

import type { Job } from '../../types/job';
import {
  calcConfidenceByFields,
  firstNonEmpty,
  type SiteAdapter,
} from '../../core/extractor/adapter';

export const zhipinAdapter: SiteAdapter = {
  id: 'zhipin',

  matches(url: string): boolean {
    return (
      url.includes('zhipin.com') && url.includes('/job_detail/')
    );
  },

  extract(doc: Document, _url: string): Partial<Job> {
    const result: Partial<Job> = {};

    // 标题：BOSS 详情页有 .job-banner .name h1 或 .info-primary .name h1
    const title =
      firstNonEmpty(doc, [
        '.job-banner .name h1',
        '.info-primary .name h1',
        '.job-name .name',
        'h1.name',
      ]) || '';
    if (title) result.title = title;

    // 公司名：.company-info .name 或 .info-company .name
    const company =
      firstNonEmpty(doc, [
        '.company-info .name',
        '.info-company .name',
        '.company-info dt',
        '.sider-company .name',
      ]) || '';
    if (company) result.company = company;

    // 薪资：.job-banner .salary 或 .info-primary .salary
    const salary =
      firstNonEmpty(doc, [
        '.job-banner .salary',
        '.info-primary .salary',
        '.job-detail .salary',
        '.salary',
      ]) || '';
    if (salary) result.salary = salary;

    // 地点：.job-banner .job-area 或 .info-primary .text
    const location =
      firstNonEmpty(doc, [
        '.job-banner .job-area',
        '.job-area',
        '.info-primary .text',
        '.location-address',
      ]) || '';
    if (location) result.location = location;

    // 描述：.job-detail 或 .job-sec-text
    const description =
      firstNonEmpty(doc, [
        '.job-detail',
        '.job-sec-text',
        '.text-landing',
      ]) || '';
    if (description) result.description = description;

    return result;
  },

  normalize(raw: Partial<Job>): Partial<Job> {
    const out: Partial<Job> = {};
    for (const key of Object.keys(raw) as (keyof Job)[]) {
      const v = raw[key];
      if (typeof v === 'string') {
        const cleaned = v.replace(/\s+/g, ' ').trim();
        if (cleaned) (out as Record<string, unknown>)[key] = cleaned;
      }
    }
    return out;
  },

  confidence(raw: Partial<Job>): number {
    return calcConfidenceByFields(raw, [
      'title',
      'company',
      'salary',
      'location',
      'description',
    ]);
  },
};
