// Adapter 注册表：导出所有适配器与默认 ExtractorEngine 实例
import { zhipinAdapter } from './site-zhipin/zhipin-adapter';
import { genericAdapter } from './generic/generic-adapter';
import { ExtractorEngine } from '../core/extractor/extractor-engine';

export { zhipinAdapter, genericAdapter, ExtractorEngine };

/** 默认引擎：先试 zhipin，回退到 generic */
export const defaultEngine = new ExtractorEngine({
  siteAdapters: [zhipinAdapter],
  fallback: genericAdapter,
});
