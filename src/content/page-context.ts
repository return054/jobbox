// 页面上下文采集 + 岗位字段提取（Stage 2）
// 此文件导出的 collectPageContext 是一个纯函数，会被 background 通过
// chrome.scripting.executeScript({ func }) 序列化后注入到目标页面执行。
// 因此函数体只能使用页面环境可用的全局 API（document / location / window 等），
// 严禁引用外部模块变量或闭包变量，否则注入后会报 ReferenceError。
//
// Stage 2: 内联 zhipin + generic 的核心 DOM 选择器，在页面上下文里直接提取岗位字段。
// 选择器逻辑与 src/adapters/site-zhipin/zhipin-adapter.ts、
// src/adapters/generic/generic-adapter.ts 保持同步。
// 后续如改用 chrome.scripting 多文件注入 adapter 模块，可移除此处的内联逻辑。

import type { Job } from '../types/job';

export interface PageContext {
  title: string;
  url: string;
  textSnippet: string;
  /** Stage 2: 从页面 DOM 提取的岗位字段（可能为空） */
  job?: Partial<Job>;
}

/**
 * 在目标页面上下文中采集标题、URL、正文片段，并提取岗位字段。
 * 1) 先尝试 zhipin adapter 的选择器（匹配 /job_detail/）
 * 2) 否则回退到 generic（JSON-LD + Open Graph + 语义规则）
 */
export function collectPageContext(): PageContext {
  const title = (document.title || '').trim();
  const url = location.href;

  const body = document.body;
  const bodyText = body?.innerText || body?.textContent || '';
  const textSnippet = bodyText.slice(0, 500).trim();

  // 提取岗位字段
  const isZhipin = url.includes('zhipin.com') && url.includes('/job_detail/');
  const job = isZhipin ? extractZhipin(document) : extractGeneric(document);

  // 清理空字符串字段
  const cleaned: Partial<Job> = {};
  for (const key of Object.keys(job) as (keyof Job)[]) {
    const v = job[key];
    if (typeof v === 'string') {
      const s = v.replace(/\s+/g, ' ').trim();
      if (s) (cleaned as Record<string, unknown>)[key] = s;
    }
  }

  return { title, url, textSnippet, job: cleaned };
}

// === zhipin adapter 选择器（与 src/adapters/site-zhipin/zhipin-adapter.ts 同步） ===

function extractZhipin(doc: Document): Partial<Job> {
  const result: Partial<Job> = {};

  const title = firstMatch(doc, [
    '.job-banner .name h1',
    '.info-primary .name h1',
    '.job-name .name',
    'h1.name',
  ]);
  if (title) result.title = title;

  const company = firstMatch(doc, [
    '.company-info .name',
    '.info-company .name',
    '.company-info dt',
    '.sider-company .name',
  ]);
  if (company) result.company = company;

  const salary = firstMatch(doc, [
    '.job-banner .salary',
    '.info-primary .salary',
    '.job-detail .salary',
    '.salary',
  ]);
  if (salary) result.salary = salary;

  const location = firstMatch(doc, [
    '.job-banner .job-area',
    '.job-area',
    '.info-primary .text',
    '.location-address',
  ]);
  if (location) result.location = location;

  const description = firstMatch(doc, [
    '.job-detail',
    '.job-sec-text',
    '.text-landing',
  ]);
  if (description) result.description = description;

  return result;
}

// === generic adapter 选择器（与 src/adapters/generic/generic-adapter.ts 同步） ===

function extractGeneric(doc: Document): Partial<Job> {
  const result: Partial<Job> = {};

  // 1) JSON-LD: schema.org/JobPosting
  const ld = extractFromJsonLd(doc);
  if (ld.title) result.title = ld.title;
  if (ld.company) result.company = ld.company;
  if (ld.salary) result.salary = ld.salary;
  if (ld.location) result.location = ld.location;
  if (ld.description) result.description = ld.description;

  // 2) Open Graph / meta 标签
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

  // 3) 语义规则
  if (!result.title) {
    const h1 = firstMatch(doc, ['h1', 'h2']);
    if (h1) result.title = h1;
  }
  if (!result.description) {
    const mainText = textOfElement(doc, 'main') || textOfElement(doc, 'article');
    if (mainText) result.description = mainText.slice(0, 1000);
  }

  return result;
}

// === 通用工具 ===

function firstMatch(doc: Document, selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const text = el?.textContent?.trim() ?? '';
    if (text) return text;
  }
  return '';
}

function metaContent(doc: Document, name: string): string {
  const byProp = doc.querySelector(`meta[property='${name}']`) as HTMLMetaElement | null;
  if (byProp?.content) return byProp.content.trim();
  const byName = doc.querySelector(`meta[name='${name}']`) as HTMLMetaElement | null;
  if (byName?.content) return byName.content.trim();
  return '';
}

function textOfElement(doc: Document, selector: string): string {
  return doc.querySelector(selector)?.textContent?.trim() ?? '';
}

// === JSON-LD 解析 ===

interface JobPostingLd {
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } };
  baseSalary?: { value?: { minValue?: number; maxValue?: number; unitText?: string } };
}

function extractFromJsonLd(doc: Document): Partial<Job> {
  const result: Partial<Job> = {};
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const s of Array.from(scripts)) {
    const text = s.textContent ?? '';
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const ld = normalizeLd(item);
        if (!ld) continue;
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
          const tmp = doc.createElement('div');
          tmp.innerHTML = ld.description;
          const text = (tmp.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (text) result.description = text.slice(0, 1000);
        }
      }
    } catch {
      // JSON 解析失败就跳过
    }
  }
  return result;
}

function normalizeLd(item: unknown): JobPostingLd | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  const t = obj['@type'];
  const types = Array.isArray(t) ? t : [t];
  const isJobPosting = types.some(
    (x) => x === 'JobPosting' || x === 'schema.org/JobPosting'
  );
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
