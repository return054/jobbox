// JobBox 核心类型定义
// 描述招聘岗位的标准化实体与提取过程的中间结果

/** 核心岗位字段：Stage 2 要求至少 5 字段稳定提取 */
export interface Job {
  /** 岗位标题，如"高级前端工程师" */
  title: string;
  /** 公司名，如"字节跳动" */
  company: string;
  /** 薪资原文，如"25-50K·14薪"（Stage 3 才做标准化拆分） */
  salary: string;
  /** 工作地点，如"北京·朝阳区·望京"（Stage 3 才做省市拆分） */
  location: string;
  /** 岗位描述正文（任职要求 / 工作内容） */
  description: string;
  /** 来源 URL */
  sourceUrl: string;
  /** 来源平台标识，如 'zhipin' / 'lagou' / 'generic' */
  source: string;
  /** 抓取时间戳（ms） */
  fetchedAt: number;
}

/** 提取引擎返回的中间结果：包含已提取字段与置信度 */
export interface ExtractResult {
  /** 提取到的字段（部分可能为空字符串） */
  job: Partial<Job>;
  /** 0-100 的置信度，越高越可信 */
  confidence: number;
  /** 提取所用的策略路径，如 'site:zhipin' / 'generic:json-ld' / 'generic:semantic' */
  strategy: string;
  /** 未命中的字段名列表 */
  missingFields: string[];
}

/** 核心字段名枚举，用于缺失检测 */
export const CORE_FIELDS: readonly (keyof Job)[] = [
  'title',
  'company',
  'salary',
  'location',
  'description',
] as const;

/** 字段是否被视为"已提取"：非空且去除空白后长度 >= 1 */
export function isFieldFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
