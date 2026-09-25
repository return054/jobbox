// 原文高亮工具（Issue #12）
// 根据命中位置（position.start/end）将 description 切分为普通文本和高亮片段
// 版权合规：只高亮命中短语本身，不修改原文其他部分

import type { InterpretationHit } from '../core/interpreter/matcher';

export interface HighlightSegment {
  text: string;
  /** 是否为命中短语（需要高亮） */
  highlight: boolean;
  /** 命中的证据等级（用于着色），普通片段为 null */
  certainty?: string;
}

/**
 * 将文本按命中位置切分为高亮片段
 * @param text 原文
 * @param hits 命中列表（需包含 position）
 * @returns 片段数组，按位置排序
 */
export function splitByHits(
  text: string,
  hits: InterpretationHit[]
): HighlightSegment[] {
  if (!text || hits.length === 0) {
    return [{ text, highlight: false }];
  }

  // 按 start 排序，处理重叠（后面的命中如果与前面重叠，跳过）
  const sorted = [...hits].sort((a, b) => a.position.start - b.position.start);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const hit of sorted) {
    const { start, end } = hit.position;
    // 跳过越界或与前一个重叠的命中
    if (start < cursor || end > text.length) continue;

    // 普通文本片段
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlight: false });
    }
    // 高亮片段
    segments.push({
      text: text.slice(start, end),
      highlight: true,
      certainty: hit.certainty,
    });
    cursor = end;
  }

  // 剩余文本
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: false });
  }

  return segments;
}

/** 证据等级对应的高亮颜色 */
export const CERTAINTY_COLORS: Record<string, string> = {
  A: '#fff1f0',
  B: '#fff7e6',
  C: '#e6f7ff',
  D: '#f5f5f5',
};
