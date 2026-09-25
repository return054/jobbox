// 质量评分：0-100 分制
// 阈值（在 validator 中消费）：
//   score >= 90 → AUTO_PASS
//   70 <= score < 90 → NEED_REVIEW
//   score < 70 → REJECT
//
// 评分维度（核心字段合计 100）：
//   title 非空                       20
//   company 非空                     20
//   salary.parsed=true               20
//   location.parsed=true             15
//   description.length >= 50         15
//   description.length >= 200        10
//   education/experience 命中加分     5  (上限截到 100)

import type {
  NormalizedEducation,
  NormalizedExperience,
  NormalizedLocation,
  NormalizedSalary,
} from '../normalizer/types';

export interface ScoringInput {
  title?: string;
  company?: string;
  salary?: NormalizedSalary;
  location?: NormalizedLocation;
  education?: NormalizedEducation;
  experience?: NormalizedExperience;
  description?: string;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

function nonEmpty(s?: string): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

export function scoreJob(input: ScoringInput): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (nonEmpty(input.title)) {
    score += 20;
    reasons.push('title:20');
  }
  if (nonEmpty(input.company)) {
    score += 20;
    reasons.push('company:20');
  }
  if (input.salary?.parsed) {
    score += 20;
    reasons.push('salary:20');
  }
  if (input.location?.parsed) {
    score += 15;
    reasons.push('location:15');
  }

  const desc = input.description?.trim() ?? '';
  if (desc.length >= 50) {
    score += 15;
    reasons.push('desc>=50:15');
    if (desc.length >= 200) {
      score += 10;
      reasons.push('desc>=200:10');
    }
  }

  if (input.education?.parsed || input.experience?.parsed) {
    score += 5;
    reasons.push('edu/exp:5');
  }

  return { score: Math.min(score, 100), reasons };
}
