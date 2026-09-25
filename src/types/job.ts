// JobBox 核心类型定义
// 描述招聘岗位的标准化实体与提取过程的中间结果

import type { NormalizedJob } from '../core/normalizer/types';
import type { ValidationResult } from '../core/validator/validator';
import type { InterpretationResult } from '../core/interpreter/types';

/**
 * 岗位申请状态机（Stage 5）
 * saved → applied → interview → offer
 *            ↘ rejected（任意阶段可转入）
 */
export type JobStatus = 'saved' | 'applied' | 'interview' | 'rejected' | 'offer';

/** 状态中文名映射，用于 UI 展示 */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: '已保存',
  applied: '已投递',
  interview: '面试中',
  rejected: '已拒绝',
  offer: '已录用',
};

/** 状态对应的主题色（用于 badge） */
export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  saved: '#8c8c8c',
  applied: '#1890ff',
  interview: '#722ed1',
  rejected: '#f5222d',
  offer: '#52c41a',
};

/** 核心岗位字段：Stage 2 要求至少 5 字段稳定提取 */
export interface Job {
  /**
   * 岗位主键：使用 fingerprintOf(job, normalized) 或 sourceUrl hash 生成
   * Stage 4 起入库时必填；从历史抓取结果导入时可能缺失，需重新计算
   */
  id?: string;
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
  /**
   * Stage 3 归一化结果（薪资/地点/学历/经验）
   * 入库时与原始字段一起持久化，避免每次查询重新解析
   */
  normalized?: NormalizedJob;
  /** Stage 3 验证结果（评分/等级/原因） */
  validation?: ValidationResult;
  /**
   * 潜台词解读结果（Issue #11）
   * 结构化输出，不修改原 Job 字段，向后兼容
   */
  interpretation?: InterpretationResult;
  /**
   * Stage 5: 申请状态，默认 'saved'
   */
  status?: JobStatus;
  /**
   * Stage 5: 用户手动打的标签（与 autoTags 分离存储，Issue #6 验收要求）
   */
  tags?: string[];
  /**
   * Stage 5: 系统自动生成的标签（如"996风险""高薪"等），用户不可直接编辑
   * 与 tags 分离存储，避免用户误删系统判断
   */
  autoTags?: string[];
  /**
   * Stage 5: 用户备注（自由文本）
   */
  notes?: string;
  /**
   * Stage 5: 最后修改时间戳（ms），用于列表排序
   */
  updatedAt?: number;
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
