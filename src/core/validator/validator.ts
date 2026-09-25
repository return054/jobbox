// 岗位验证：根据评分给出三档判定
//   score >= 90 → AUTO_PASS（valid=true，自动入库）
//   70 <= score < 90 → NEED_REVIEW（valid=false，人工确认）
//   score < 70 → REJECT（valid=false，丢弃）

import type { ScoringInput } from '../scoring/scoring';
import { scoreJob } from '../scoring/scoring';

export type ValidationLevel = 'AUTO_PASS' | 'NEED_REVIEW' | 'REJECT';

export interface ValidationResult {
  valid: boolean;
  score: number;
  level: ValidationLevel;
  reasons: string[];
}

export function validate(input: ScoringInput): ValidationResult {
  const { score, reasons } = scoreJob(input);
  let level: ValidationLevel;
  let valid: boolean;
  if (score >= 90) {
    level = 'AUTO_PASS';
    valid = true;
  } else if (score >= 70) {
    level = 'NEED_REVIEW';
    valid = false;
  } else {
    level = 'REJECT';
    valid = false;
  }
  return { valid, score, level, reasons };
}
