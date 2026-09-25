// 潜台词解读结果类型（Issue #11）
// 三层框架：公开信息(A) / 常见含义(B) / 待确认(C/D)
// interpretation 作为 Job 的附加字段，不修改原 Job 字段，向后兼容

import type { InterpretationHit } from './matcher';

/** 解读引擎版本号，用于持久化后判断是否需要重新解读 */
export const INTERPRETER_VERSION = '1.0.0';

/**
 * 三层解读输出
 *  - publicInfo: A 级命中，原文明确陈述的事实
 *  - commonMeaning: B 级命中，行业黑话的常见含义
 *  - toConfirm: C/D 级命中，需要向 HR 确认的事项
 */
export interface InterpretationResult {
  /** 所有命中短语（按位置排序） */
  hits: InterpretationHit[];
  /** 公开信息层：A 级命中 */
  publicInfo: InterpretationHit[];
  /** 常见含义层：B 级命中 */
  commonMeaning: InterpretationHit[];
  /** 待确认层：C/D 级命中 */
  toConfirm: InterpretationHit[];
  /** 汇总所有待确认问题（去重） */
  pendingQuestions: string[];
  /** 风险标记：A/B 级命中的短语 ID 列表 */
  riskFlags: string[];
  /** 解读生成时间戳（ms） */
  generatedAt: number;
  /** 解读引擎版本 */
  engineVersion: string;
}

/** 空解读结果（未命中时使用） */
export function emptyInterpretation(): InterpretationResult {
  return {
    hits: [],
    publicInfo: [],
    commonMeaning: [],
    toConfirm: [],
    pendingQuestions: [],
    riskFlags: [],
    generatedAt: Date.now(),
    engineVersion: INTERPRETER_VERSION,
  };
}
