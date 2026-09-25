// 潜台词短语词典类型定义（Issue #9）
// 词典是数据不是代码：src/data/phrase-dictionary.ts，可独立测试、版本化

import type { EvidenceLevel } from '../core/normalizer/types';

/** 短语分类：覆盖招聘 JD 中常见的 6 大潜台词领域 */
export type PhraseCategory =
  | 'WORKLOAD' // 工作强度（加班、大小周、996）
  | 'SALARY' // 薪资结构（13薪、年终奖、绩效）
  | 'MANAGEMENT' // 管理方式（扁平化、汇报、OKR）
  | 'CULTURE' // 组织氛围（狼性、拥抱变化、快节奏）
  | 'CONTENT' // 工作内容（全栈、打杂、owner）
  | 'CONTRACT'; // 合同保障（外包、试用期、五险一金）

/** 分类中文名映射 */
export const PHRASE_CATEGORY_LABELS: Record<PhraseCategory, string> = {
  WORKLOAD: '工作强度',
  SALARY: '薪资结构',
  MANAGEMENT: '管理方式',
  CULTURE: '组织氛围',
  CONTENT: '工作内容',
  CONTRACT: '合同保障',
};

/** 短语条目状态 */
export type PhraseStatus = 'active' | 'draft' | 'deprecated';

/** 短语来源：curated=人工 curated，ai=AI 生成（V1.1 兜底用） */
export type PhraseSource = 'curated' | 'ai';

/**
 * 不同证据等级下的解读文本
 * 同一短语在 A/B/C/D 级证据下可能有不同解读深度
 */
export interface PhraseInterpretation {
  level: EvidenceLevel;
  /** 解读文本。B/C 级必须以"可能"开头，避免过度断言 */
  text: string;
}

/**
 * 短语词典条目
 * 每条记录一个招聘黑话/潜台词短语及其多维度解读
 */
export interface PhraseEntry {
  /** 唯一 ID，如 'workload-996' */
  id: string;
  /** 核心短语，如 "996" */
  phrase: string;
  /** 别名列表，用于扩展匹配，如 ["996工作制", "早9晚9"] */
  aliases: string[];
  /** 分类 */
  category: PhraseCategory;
  /** 不同证据等级下的解读 */
  interpretations: PhraseInterpretation[];
  /** 该短语的默认证据等级（词典 curated 时的基准等级） */
  certainty: EvidenceLevel;
  /** 建议向 HR/面试官确认的问题 */
  questions: string[];
  /** 证据描述：说明为什么这个短语有此潜台词（简短） */
  evidence: string;
  /** 来源 */
  source: PhraseSource;
  /** 状态 */
  status: PhraseStatus;
}
