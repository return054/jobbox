// 学历归一化
// 按 EDUCATION_LEVELS 顺序（从高到低）匹配，命中即返回该 level
//   "本科及以上" → 本科
//   "硕士优先"   → 硕士
//   "大专或本科" → 硕士（先匹配，但意思接受任一）
//   "学历不限"   → 不限
//   "无要求"     → 不限（兜底）

import { EDUCATION_LEVELS, type NormalizedEducation } from './types';

const EMPTY: NormalizedEducation = {
  raw: '', level: '不限', parsed: false,
};

export function normalizeEducation(input: string): NormalizedEducation {
  const raw = (input ?? '').trim();
  if (!raw) return { ...EMPTY, raw };

  // 显式不限 / 无要求
  if (/不限|无要求|无学历|学历不限/.test(raw)) {
    return { raw, level: '不限', parsed: true };
  }

  for (const level of EDUCATION_LEVELS) {
    if (raw.includes(level)) {
      return { raw, level, parsed: true };
    }
  }
  return { raw, level: '不限', parsed: false };
}
