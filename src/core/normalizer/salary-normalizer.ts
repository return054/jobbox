// 薪资归一化
// 验收 case：
//   "5-8K·13薪"  → { min:5000, max:8000, unit:MONTH, months:13 }
//   "25-50K·14薪" → { min:25000, max:50000, unit:MONTH, months:14 }
//   "10-15K/月"   → { min:10000, max:15000, unit:MONTH, months:12 }
//   "面议"        → parsed:false

import type { NormalizedSalary, SalaryUnit } from './types';

const EMPTY: NormalizedSalary = {
  raw: '', min: 0, max: 0, unit: 'UNKNOWN', months: 12, parsed: false,
};

/** 单位字符 → 乘数（K=千 W/万=万） */
function unitMultiplier(c: string): number {
  if (c === 'K' || c === 'k') return 1000;
  if (c === 'W' || c === 'w') return 10000;
  if (c === '万') return 10000;
  return 1; // 元 或纯数字
}

export function normalizeSalary(input: string): NormalizedSalary {
  const raw = (input ?? '').trim();
  if (!raw) return { ...EMPTY, raw };
  // 不含任何数字 → 面议 / 不告知
  if (!/\d/.test(raw)) return { ...EMPTY, raw };

  // 提取月份：13薪 / 14薪 / 15薪
  const monthsMatch = raw.match(/(\d{1,2})\s*薪/);
  const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 12;

  // 推断单位：年 / 天 / 月
  let unit: SalaryUnit = 'MONTH';
  if (/\/年|\/year|万年|万\/年|k\/年/i.test(raw)) unit = 'YEAR';
  else if (/\/天|\/day|元\/天|按天/i.test(raw)) unit = 'UNKNOWN';

  // 提取数字范围：5-8 / 5~8 / 5到8 / 5–8
  const rangeMatch = raw.match(
    /(\d+(?:\.\d+)?)\s*[-–~到至]+\s*(\d+(?:\.\d+)?)\s*([KkWw万元]?)/
  );
  if (rangeMatch) {
    const mul = unitMultiplier(rangeMatch[3] ?? '');
    const min = parseFloat(rangeMatch[1]) * mul;
    const max = parseFloat(rangeMatch[2]) * mul;
    return {
      raw, min: Math.round(min), max: Math.round(max),
      unit, months, parsed: true,
    };
  }

  // 单数字：5K / 8000
  const singleMatch = raw.match(/(\d+(?:\.\d+)?)\s*([KkWw万元]?)/);
  if (singleMatch) {
    const mul = unitMultiplier(singleMatch[2] ?? '');
    const v = parseFloat(singleMatch[1]) * mul;
    return {
      raw, min: Math.round(v), max: Math.round(v),
      unit, months, parsed: true,
    };
  }

  return { ...EMPTY, raw };
}
