// 短语词典单元测试（Issue #9）
// 验收标准：
//   - 30 条 active 条目，每条含 interpretations + questions
//   - B/C 级 interpret 均以"可能"开头
//   - 每条有 evidence

import { describe, it, expect } from 'vitest';
import { getActivePhrases } from './phrase-dictionary';

describe('短语词典 v1', () => {
  const active = getActivePhrases();

  it('active 条目数量 >= 30', () => {
    expect(active.length).toBeGreaterThanOrEqual(30);
  });

  it('每条 active 条目含 interpretations + questions + evidence', () => {
    for (const p of active) {
      expect(p.interpretations.length).toBeGreaterThanOrEqual(1);
      expect(p.questions.length).toBeGreaterThanOrEqual(1);
      expect(p.evidence.trim().length).toBeGreaterThan(0);
    }
  });

  it('B/C 级 interpret 均以"可能"开头', () => {
    for (const p of active) {
      for (const interp of p.interpretations) {
        if (interp.level === 'B' || interp.level === 'C') {
          expect(interp.text.startsWith('可能')).toBe(true);
        }
      }
    }
  });

  it('每条 id 唯一', () => {
    const ids = new Set(active.map((p) => p.id));
    expect(ids.size).toBe(active.length);
  });

  it('覆盖 6 大分类', () => {
    const categories = new Set(active.map((p) => p.category));
    expect(categories.size).toBe(6);
  });

  it('source 均为 curated', () => {
    for (const p of active) {
      expect(p.source).toBe('curated');
    }
  });

  it('aliases 不包含主短语本身', () => {
    for (const p of active) {
      expect(p.aliases).not.toContain(p.phrase);
    }
  });

  // 抽查几个关键条目
  it('996 条目存在且 certainty=A', () => {
    const p = active.find((x) => x.id === 'workload-996');
    expect(p).toBeDefined();
    expect(p!.certainty).toBe('A');
    expect(p!.phrase).toBe('996');
  });

  it('狼性条目存在且 certainty=A', () => {
    const p = active.find((x) => x.id === 'culture-langxing');
    expect(p).toBeDefined();
    expect(p!.certainty).toBe('A');
  });

  it('外包条目存在且 certainty=A', () => {
    const p = active.find((x) => x.id === 'contract-waibao');
    expect(p).toBeDefined();
    expect(p!.certainty).toBe('A');
  });

  it('弹性工作 certainty=C，B/C 级解读以"可能"开头', () => {
    const p = active.find((x) => x.id === 'workload-tanxing');
    expect(p).toBeDefined();
    expect(p!.certainty).toBe('C');
    for (const interp of p!.interpretations) {
      if (interp.level === 'B' || interp.level === 'C') {
        expect(interp.text.startsWith('可能')).toBe(true);
      }
    }
  });
});
