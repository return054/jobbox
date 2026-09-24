// 经验归一化
// 验收 case：
//   "5-10年"    → { min:5, max:10, unit:YEAR }
//   "3年以上"   → { min:3, max:0, unit:YEAR }   // max=0 表示不限上限
//   "3年以下"   → { min:0, max:3, unit:YEAR }
//   "经验不限" / "应届生" → { min:0, max:0, unit:YEAR }
//   "3年"      → { min:3, max:3, unit:YEAR }    // 精确 X 年

import type { NormalizedExperience } from './types';

const EMPTY: NormalizedExperience = {
  raw: '', min: 0, max: 0, unit: 'YEAR', parsed: false,
};

export function normalizeExperience(input: string): NormalizedExperience {
  const raw = (input ?? '').trim();
  if (!raw) return { ...EMPTY, raw };

  // 不限 / 应届 / 无经验
  if (/不限|应届|无经验|经验不限|经验无要求/.test(raw)) {
    return { raw, min: 0, max: 0, unit: 'YEAR', parsed: true };
  }

  // 范围：5-10年 / 5~10年 / 5到10年 / 5–10年
  const rangeMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*[-–~到至]+\s*(\d+(?:\.\d+)?)\s*年/
  );
  if (rangeMatch) {
    return {
      raw,
      min: parseFloat(rangeMatch[1]),
      max: parseFloat(rangeMatch[2]),
      unit: 'YEAR',
      parsed: true,
    };
  }

  // 单数字 + 以上/以下
  const singleMatch = raw.match(/(\d+(?:\.\d+)?)\s*年?(以上|以下|or more|or less|up to|至少|最多)/);
  if (singleMatch) {
    const v = parseFloat(singleMatch[1]);
    if (/以上|or more|至少/.test(raw)) {
      return { raw, min: v, max: 0, unit: 'YEAR', parsed: true };
    }
    return { raw, min: 0, max: v, unit: 'YEAR', parsed: true };
  }

  // 单数字 + 年："3年" 当成"3年经验" → min=max=3
  const justYears = raw.match(/(\d+(?:\.\d+)?)\s*年/);
  if (justYears) {
    const v = parseFloat(justYears[1]);
    return { raw, min: v, max: v, unit: 'YEAR', parsed: true };
  }

  return { ...EMPTY, raw };
}
