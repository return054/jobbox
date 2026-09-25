// 潜台词匹配引擎（Issue #10）
// 从岗位 description 文本中匹配词典条目，输出 InterpretationHit[]
//
// 匹配优先级链：
//   1. 精确匹配 phrase 原文
//   2. 匹配 aliases 别名
//   3. 模糊匹配（n-gram 相似度 >= 阈值）
//   4. 上下文加权：命中"任职要求"段权重高于"公司介绍"段
//
// 证据等级调整：
//   - 精确命中 → 维持词典 certainty
//   - 别名命中 → certainty 降一级（A→B, B→C, C→D）
//   - 模糊命中 → certainty 强制 <= C
//   - AI 兜底 → certainty 强制 <= C，source='ai'（V1 默认关闭）

import type { EvidenceLevel } from '../normalizer/types';
import type { PhraseEntry } from '../../types/phrase';
import { getActivePhrases } from '../../data/phrase-dictionary';

/** 命中位置（字符偏移），用于原文高亮 */
export interface HitPosition {
  /** 命中文本在 description 中的起始偏移 */
  start: number;
  /** 命中文本在 description 中的结束偏移 */
  end: number;
}

/** 匹配结果 */
export interface InterpretationHit {
  /** 命中的词典条目 ID */
  phraseId: string;
  /** 命中的实际文本（可能是 phrase 或 alias） */
  matchedText: string;
  /** 命中的短语分类 */
  category: string;
  /** 证据等级（已根据匹配方式调整） */
  certainty: EvidenceLevel;
  /** 该等级下的解读文本 */
  interpretation: string;
  /** 建议确认的问题 */
  questions: string[];
  /** 命中位置 */
  position: HitPosition;
  /** 匹配方式 */
  matchType: 'exact' | 'alias' | 'fuzzy';
  /** 来源 */
  source: 'curated' | 'ai';
}

/** 匹配器选项 */
export interface MatcherOptions {
  /** 模糊匹配相似度阈值（0-1），默认 0.8 */
  fuzzyThreshold?: number;
  /** AI 兜底是否启用，V1 默认关闭 */
  enableAiFallback?: boolean;
}

/** 段落类型：用于上下文加权 */
type SectionType = 'requirements' | 'introduction' | 'other';

/** 段落关键词，用于识别段落类型 */
const REQUIREMENTS_KEYWORDS = ['任职要求', '任职资格', '岗位要求', '职位要求', '技能要求', '要求'];
const INTRODUCTION_KEYWORDS = ['公司介绍', '关于我们', '公司简介', '企业介绍'];

/** 判断某段文本属于哪个段落类型 */
function detectSection(text: string): SectionType {
  if (REQUIREMENTS_KEYWORDS.some((k) => text.includes(k))) return 'requirements';
  if (INTRODUCTION_KEYWORDS.some((k) => text.includes(k))) return 'introduction';
  return 'other';
}

/** 计算两段文本的 n-gram 相似度（Dice coefficient） */
function ngramSimilarity(a: string, b: string, n = 2): number {
  if (a === b) return 1;
  if (a.length < n || b.length < n) return a === b ? 1 : 0;
  const gramsA = new Set<string>();
  const gramsB = new Set<string>();
  for (let i = 0; i <= a.length - n; i++) gramsA.add(a.slice(i, i + n));
  for (let i = 0; i <= b.length - n; i++) gramsB.add(b.slice(i, i + n));
  let intersect = 0;
  for (const g of gramsA) if (gramsB.has(g)) intersect++;
  return (2 * intersect) / (gramsA.size + gramsB.size);
}

/** 证据等级降一级 */
function downgrade(level: EvidenceLevel): EvidenceLevel {
  switch (level) {
    case 'A': return 'B';
    case 'B': return 'C';
    case 'C': return 'D';
    case 'D': return 'D';
  }
}

/** 获取指定等级下的解读文本（找不到则取最高可用等级） */
function getInterpretationText(entry: PhraseEntry, level: EvidenceLevel): string {
  const exact = entry.interpretations.find((i) => i.level === level);
  if (exact) return exact.text;
  // 回退：取 certainty 等级的解读
  const fallback = entry.interpretations.find((i) => i.level === entry.certainty);
  if (fallback) return fallback.text;
  return entry.interpretations[0]?.text ?? '';
}

/**
 * 潜台词匹配器
 * @param description 岗位描述原文
 * @param options 匹配选项
 * @returns 命中列表
 */
export function matchPhrases(
  description: string,
  options: MatcherOptions = {}
): InterpretationHit[] {
  const { fuzzyThreshold = 0.8, enableAiFallback = false } = options;
  if (!description.trim()) return [];

  const phrases = getActivePhrases();
  const hits: InterpretationHit[] = [];
  const seenPhraseIds = new Set<string>();

  for (const entry of phrases) {
    if (seenPhraseIds.has(entry.id)) continue;

    const candidates = [entry.phrase, ...entry.aliases];
    let bestMatch: { text: string; start: number; type: 'exact' | 'alias' | 'fuzzy' } | null = null;

    for (const candidate of candidates) {
      if (!candidate) continue;
      const idx = description.indexOf(candidate);
      if (idx >= 0) {
        bestMatch = {
          text: candidate,
          start: idx,
          type: candidate === entry.phrase ? 'exact' : 'alias',
        };
        break;
      }
    }

    // 模糊匹配（仅在精确/别名未命中时）
    if (!bestMatch) {
      const fuzzy = findFuzzyMatch(description, entry.phrase, fuzzyThreshold);
      if (fuzzy) {
        bestMatch = { text: fuzzy.text, start: fuzzy.start, type: 'fuzzy' };
      }
    }

    if (!bestMatch) continue;

    // 判断命中位置所在段落（用于上下文加权）
    const sectionText = description.slice(Math.max(0, bestMatch.start - 20), bestMatch.start + bestMatch.text.length + 20);
    const section = detectSection(sectionText);

    // 根据匹配方式调整 certainty
    let certainty: EvidenceLevel = entry.certainty;
    if (bestMatch.type === 'alias') certainty = downgrade(certainty);
    if (bestMatch.type === 'fuzzy') {
      // 模糊匹配强制 <= C
      certainty = certainty === 'A' || certainty === 'B' ? 'C' : certainty;
    }
    // 上下文加权：任职要求段提升确定性（不超过 A）
    if (section === 'requirements' && certainty !== 'A') {
      certainty = certainty === 'D' ? 'C' : (certainty === 'C' ? 'B' : certainty);
    }
    // 公司介绍段降低确定性
    if (section === 'introduction' && certainty !== 'D') {
      certainty = downgrade(certainty);
    }

    hits.push({
      phraseId: entry.id,
      matchedText: bestMatch.text.slice(0, 20), // 版权合规：只存 <=20 字
      category: entry.category,
      certainty,
      interpretation: getInterpretationText(entry, certainty),
      questions: entry.questions,
      position: { start: bestMatch.start, end: bestMatch.start + bestMatch.text.length },
      matchType: bestMatch.type,
      source: entry.source,
    });
    seenPhraseIds.add(entry.id);
  }

  // AI 兜底（V1 默认关闭）
  if (enableAiFallback && hits.length === 0) {
    // V1.1 实现：调用 LLM 生成解读，certainty 强制 <= C，source='ai'
    // 此处留空，V1 不实现
  }

  // 按命中位置排序
  hits.sort((a, b) => a.position.start - b.position.start);
  return hits;
}

/** 模糊匹配：在文本中找与目标短语 n-gram 相似度 >= 阈值的子串 */
function findFuzzyMatch(
  text: string,
  target: string,
  threshold: number
): { text: string; start: number } | null {
  const targetLen = target.length;
  // 只在目标长度 ±50% 的窗口内搜索
  const minLen = Math.max(2, Math.floor(targetLen * 0.5));
  const maxLen = Math.min(text.length, Math.ceil(targetLen * 1.5));

  let best: { text: string; start: number; score: number } | null = null;

  for (let len = minLen; len <= maxLen; len++) {
    for (let i = 0; i <= text.length - len; i++) {
      const substr = text.slice(i, i + len);
      const score = ngramSimilarity(substr, target);
      if (score >= threshold && (!best || score > best.score)) {
        best = { text: substr, start: i, score };
      }
    }
  }

  return best ? { text: best.text, start: best.start } : null;
}
