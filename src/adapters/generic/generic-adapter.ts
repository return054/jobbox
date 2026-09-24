// GenericAdapter：兜底适配器，处理未知站点
// 提取策略链：
//   1) JSON-LD（<script type="application/ld+json">，schema.org/JobPosting）
//   2) Open Graph / meta 标签（og:title、og:description、application-name 等）
//   3) 语义规则（页面常见结构：h1 作 title、main 文本作 description 等）
// 优先级从前到后，第一个能填的字段就用。

import type { Job } from '../../types/job';
import { calcConfidenceByFields, firstNonEmpty, type SiteAdapter } from '../../core/extractor/adapter';

interface JobPostingLd {
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } };
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; unitText?: string } };
}

export const genericAdapter: SiteAdapter = {
  id: 'generic',

  matches(_url: string): boolean {
    // 兜底适配器始终匹配，作为最后一道
    return true;
  },

  extract(doc: Document, _url: string): Partial<Job> {
    const result: Partial<Job> = {};

    // === 1) JSON-LD: schema.org/JobPosting ===
    const ldResult = extractFromJsonLd(doc);
    if (ldResult.title) result.title = ldResult.title;
    if (ldResult.company) result.company = ldResult.company;
    if (ldResult.salary) result.salary = ldResult.salary;
    if (ldResult.location) result.location = ldResult.location;
    if (ldResult.description) result.description = ldResult.description;

    // === 2) Open Graph / meta 标签 ===
    if (!result.title) {
      const ogTitle = metaContent(doc, 'og:title') || metaContent(doc, 'application-name');
      if (ogTitle) result.title = ogTitle;
    }
    if (!result.company) {
      const ogSite = metaContent(doc, 'og:site_name') || metaContent(doc, 'author');
      if (ogSite) result.company = ogSite;
    }
    if (!result.description) {
      const ogDesc = metaContent(doc, 'og:description') || metaContent(doc, 'description');
      if (ogDesc) result.description = ogDesc;
    }

    // === 3) 语义规则 ===
    if (!result.title) {
      const h1 = firstNonEmpty(doc, ['h1', 'h2']);
      if (h1) result.title = h1;
    }
    if (!result.description) {
      // 优先 main / article，回退 body
      const mainText = textOfElement(doc, 'main') || textOfElement(doc, 'article');
      if (mainText) result.description = mainText.slice(0, 1000);
    }

    return result;
  },

  normalize(raw: Partial<Job>): Partial<Job> {
    const out: Partial<Job> = {};
    for (const key of Object.keys(raw) as (keyof Job)[]) {
      const v = raw[key];
      if (typeof v === 'string') {
        // 折叠多余空白
        const cleaned = v.replace(/\s+/g, ' ').trim();
        if (cleaned) (out as Record<string, unknown>)[key] = cleaned;
      }
    }
    return out;
  },

  confidence(raw: Partial<Job>): number {
    return calcConfidenceByFields(raw, ['title', 'company', 'salary', 'location', 'description']);
  },
};

// === 内部工具 ===

function metaContent(doc: Document, name: string): string {
  // 兼容 property="og:xxx" 与 name="xxx"
  const byProp = doc.querySelector(`meta[property='${name}']`) as HTMLMetaElement | null;
  if (byProp?.content) return byProp.content.trim();
  const byName = doc.querySelector(`meta[name='${name}']`) as HTMLMetaElement | null;
  if (byName?.content) return byName.content.trim();
  return '';
}

function textOfElement(doc: Document, selector: string): string {
  const el = doc.querySelector(selector);
  return el?.textContent?.trim() ?? '';
}

function extractFromJsonLd(doc: Document): Partial<Job> {
  const result: Partial<Job> = {};
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const s of scripts) {
    const text = s.textContent ?? '';
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const ld = normalizeLd(item);
        if (ld) {
          if (!result.title && ld.title) result.title = ld.title;
          if (!result.company && ld.hiringOrganization?.name) {
            result.company = ld.hiringOrganization.name;
          }
          if (!result.location) {
            const loc = formatLdLocation(ld);
            if (loc) result.location = loc;
          }
          if (!result.salary) {
            const sal = formatLdSalary(ld);
            if (sal) result.salary = sal;
          }
          if (!result.description && ld.description) {
            // description 可能含 HTML，取纯文本前 1000 字
            const tmp = doc.createElement('div');
            tmp.innerHTML = ld.description;
            const text = (tmp.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text) result.description = text.slice(0, 1000);
          }
        }
      }
    } catch {
      // JSON 解析失败就跳过，继续下一个
    }
  }
  return result;
}

function normalizeLd(item: unknown): JobPostingLd | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  // 兼容 @type 为字符串或数组
  const t = obj['@type'];
  const types = Array.isArray(t) ? t : [t];
  const isJobPosting = types.some((x) => x === 'JobPosting' || x === 'schema.org/JobPosting');
  if (!isJobPosting) return null;
  return obj as unknown as JobPostingLd;
}

function formatLdLocation(ld: JobPostingLd): string {
  const addr = ld.jobLocation?.address;
  if (!addr) return '';
  const parts = [addr.addressLocality, addr.addressRegion].filter(Boolean);
  return parts.join('·');
}

function formatLdSalary(ld: JobPostingLd): string {
  const base = ld.baseSalary;
  if (!base?.value) return '';
  const v = base.value;
  if (typeof v.minValue === 'number' && typeof v.maxValue === 'number') {
    const unit = v.unitText || '';
    return `${v.minValue}-${v.maxValue}${unit ? '·' + unit : ''}`;
  }
  return '';
}
