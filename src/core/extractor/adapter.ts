// SiteAdapter 接口定义
// 所有站点适配器（zhipin / lagou / boss / generic）都需实现此接口
// 提取优先级：站点 adapter.matches(url) 命中则先用站点 adapter；
// 否则回退到 GenericAdapter（JSON-LD + 语义规则）。

import type { ExtractResult, Job } from '../../types/job';

export interface SiteAdapter {
  /** 平台标识，如 'zhipin' / 'lagou' / 'generic' */
  readonly id: string;
  /** 判断 URL 是否由本适配器处理 */
  matches(url: string): boolean;
  /** 从 DOM 提取原始字段，返回部分 Job */
  extract(doc: Document, url: string): Partial<Job>;
  /** 归一化：清理空白、统一字段格式（不涉及 Stage 3 的薪资/省市拆分） */
  normalize(raw: Partial<Job>): Partial<Job>;
  /** 根据提取到的字段计算置信度 0-100 */
  confidence(raw: Partial<Job>): number;
}

/** 通用工具：安全取元素文本 */
export function textOf(doc: Document, selector: string): string {
  const el = doc.querySelector(selector);
  const text = el?.textContent?.trim() ?? '';
  return text;
}

/** 通用工具：取多元素中第一个非空文本 */
export function firstNonEmpty(doc: Document, selectors: readonly string[]): string {
  for (const sel of selectors) {
    const text = textOf(doc, sel);
    if (text) return text;
  }
  return '';
}

/** 通用工具：基于已提取字段计算 confidence（每字段 20 分，5 字段共 100） */
export function calcConfidenceByFields(
  raw: Partial<Job>,
  fields: readonly (keyof Job)[]
): number {
  let score = 0;
  for (const f of fields) {
    const v = raw[f];
    if (typeof v === 'string' && v.trim().length > 0) score += 20;
  }
  return score;
}

/** 构造一个 ExtractResult */
export function buildExtractResult(
  raw: Partial<Job>,
  strategy: string,
  fields: readonly (keyof Job)[]
): ExtractResult {
  const missingFields = fields.filter((f) => {
    const v = raw[f];
    return !(typeof v === 'string' && v.trim().length > 0);
  }).map(String);
  const confidence = calcConfidenceByFields(raw, fields);
  return { job: raw, confidence, strategy, missingFields };
}
