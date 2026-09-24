// 归一化后的字段结构定义
// 不污染 src/types/job.ts 的原始 Job 实体，归一化结果单独承载

/** 薪资单位：月薪 / 年薪 / 未知 */
export type SalaryUnit = 'MONTH' | 'YEAR' | 'UNKNOWN';

/**
 * 薪资归一化结果
 * 验收 case："5-8K·13薪" → { min:5000, max:8000, unit:MONTH, months:13 }
 */
export interface NormalizedSalary {
  raw: string;
  /** 最低薪资（元） */
  min: number;
  /** 最高薪资（元） */
  max: number;
  unit: SalaryUnit;
  /** 12/13/14/15 等，无 X 薪标注时默认 12 */
  months: number;
  /** 是否成功解析（min>0 或 max>0 视为成功） */
  parsed: boolean;
}

/** 地点归一化结果
 * 验收 case："杭州余杭区" → { province:'浙江', city:'杭州', district:'余杭区' }
 */
export interface NormalizedLocation {
  raw: string;
  province: string;
  city: string;
  district: string;
  parsed: boolean;
}

/** 学历枚举（从高到低，'不限'为兜底） */
export const EDUCATION_LEVELS = [
  '博士', '硕士', '本科', '大专', '高中', '不限',
] as const;
export type Education = (typeof EDUCATION_LEVELS)[number];

export interface NormalizedEducation {
  raw: string;
  level: Education;
  parsed: boolean;
}

/** 经验归一化：max=0 表示不限上限 */
export interface NormalizedExperience {
  raw: string;
  min: number;
  max: number;
  unit: 'YEAR';
  parsed: boolean;
}

/**
 * 潜台词证据等级枚举（Stage 3 只定义枚举与结构，词典数据是 Issue #9 的活）
 * - A：原文明确陈述（如"接受 996""周报节奏"）
 * - B：行业黑话出现且语义可识别（如"狼性""拥抱变化"）
 * - C：词法命中但语义弱（如"快节奏"也可能只是项目临时阶段）
 * - D：孤立关键词，无上下文支持
 */
export type EvidenceLevel = 'A' | 'B' | 'C' | 'D';

export interface NormalizedJob {
  salary: NormalizedSalary;
  location: NormalizedLocation;
  education: NormalizedEducation;
  experience: NormalizedExperience;
}
