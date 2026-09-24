// ExtractorEngine：调度适配器，按优先级链提取
// 优先级：站点 adapter (matches=true) → GenericAdapter (JSON-LD + 语义)
// 第一个能成功提取（confidence > 0）的 adapter 胜出

import type { ExtractResult, Job } from '../../types/job';
import { CORE_FIELDS } from '../../types/job';
import { buildExtractResult, type SiteAdapter } from './adapter';
import { genericAdapter } from '../../adapters/generic/generic-adapter';

export interface ExtractorOptions {
  /** 站点适配器列表，按注册顺序尝试 */
  siteAdapters?: SiteAdapter[];
  /** 兜底适配器（默认为 genericAdapter） */
  fallback?: SiteAdapter;
}

export class ExtractorEngine {
  private readonly siteAdapters: SiteAdapter[];
  private readonly fallback: SiteAdapter;

  constructor(opts: ExtractorOptions = {}) {
    this.siteAdapters = opts.siteAdapters ?? [];
    this.fallback = opts.fallback ?? genericAdapter;
  }

  /**
   * 提取入口。
   * @param doc 目标页面的 Document（由 content script 注入后采集）
   * @param url 目标页面 URL
   * @returns ExtractResult，包含 partial Job、confidence、strategy
   */
  extract(doc: Document, url: string): ExtractResult {
    // 1) 找匹配的站点 adapter
    for (const adapter of this.siteAdapters) {
      if (!adapter.matches(url)) continue;
      const raw = this.runAdapter(adapter, doc, url);
      const result = buildExtractResult(raw, `site:${adapter.id}`, CORE_FIELDS);
      if (result.confidence > 0) return result;
    }

    // 2) 回退到 generic
    const raw = this.runAdapter(this.fallback, doc, url);
    return buildExtractResult(raw, `generic:${this.fallback.id}`, CORE_FIELDS);
  }

  /** 跑完整 extract → normalize 链 */
  private runAdapter(
    adapter: SiteAdapter,
    doc: Document,
    url: string
  ): Partial<Job> {
    const extracted = adapter.extract(doc, url);
    const normalized = adapter.normalize(extracted);
    return { ...normalized, source: adapter.id, sourceUrl: url };
  }
}
