// 潜台词解读聚合器（Issue #11）
// 职责：
//   1. 调用 matcher 从 description 匹配词典短语
//   2. 按证据等级分层：A→publicInfo, B→commonMeaning, C/D→toConfirm
//   3. 汇总待确认问题（去重）
//   4. 提取风险标记（A/B 级命中）
//   5. D 级命中显示"无法仅凭此判断"而非强行翻译
//
// 插入位置：标准化之后、质量评分之前
// 不修改原 Job 字段，interpretation 作为附加字段

import type { Job } from '../../types/job';
import { matchPhrases, type MatcherOptions } from './matcher';
import {
  INTERPRETER_VERSION,
  type InterpretationResult,
  emptyInterpretation,
} from './types';
import { createLogger } from '../../utils/logger';

const log = createLogger('interpreter');

/** D 级统一提示文案 */
const D_LEVEL_FALLBACK = '无法仅凭此判断，建议向 HR 确认具体含义。';

/**
 * 解读岗位描述，返回结构化三层解读结果
 * @param job 岗位（使用 description 字段）
 * @param options 匹配选项
 * @returns InterpretationResult
 */
export function interpret(job: Job, options?: MatcherOptions): InterpretationResult {
  const description = job.description ?? '';
  if (!description.trim()) {
    log.info('description 为空，返回空解读');
    return emptyInterpretation();
  }

  const hits = matchPhrases(description, options);

  if (hits.length === 0) {
    log.info('未命中任何潜台词短语');
    return emptyInterpretation();
  }

  // 按证据等级分层
  const publicInfo = hits.filter((h) => h.certainty === 'A');
  const commonMeaning = hits.filter((h) => h.certainty === 'B');
  const toConfirm = hits.filter((h) => h.certainty === 'C' || h.certainty === 'D');

  // D 级统一替换为"无法仅凭此判断"
  const normalizedToConfirm = toConfirm.map((h) =>
    h.certainty === 'D'
      ? { ...h, interpretation: D_LEVEL_FALLBACK }
      : h
  );

  // 汇总待确认问题（去重）
  const pendingQuestions = Array.from(
    new Set(hits.flatMap((h) => h.questions))
  );

  // 风险标记：A/B 级命中的短语 ID
  const riskFlags = [...publicInfo, ...commonMeaning].map((h) => h.phraseId);

  log.info('潜台词解读完成', {
    total: hits.length,
    publicInfo: publicInfo.length,
    commonMeaning: commonMeaning.length,
    toConfirm: toConfirm.length,
  });

  return {
    hits,
    publicInfo,
    commonMeaning,
    toConfirm: normalizedToConfirm,
    pendingQuestions,
    riskFlags,
    generatedAt: Date.now(),
    engineVersion: INTERPRETER_VERSION,
  };
}

/**
 * 将解读结果附加到 Job（不修改原字段，返回新对象）
 * 保证向后兼容：不修改原 Job 的任何字段
 */
export function attachInterpretation(
  job: Job,
  result: InterpretationResult
): Job {
  return { ...job, interpretation: result };
}
