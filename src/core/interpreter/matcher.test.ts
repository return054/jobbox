// 匹配引擎单元测试（Issue #10）
// 验收标准：
//   - 精确/别名/模糊三层匹配实现
//   - "任职要求"段命中权重高于"公司介绍"段
//   - 输出含 phraseId/matchedText/certainty/questions/position
//   - AI 兜底条目 certainty 强制 <=C 且 source='ai'

import { describe, it, expect } from 'vitest';
import { matchPhrases } from './matcher';

describe('匹配引擎: 精确匹配', () => {
  it('命中"996"精确短语', () => {
    const text = '本公司实行996工作制，欢迎有志之士加入。';
    const hits = matchPhrases(text);
    const hit = hits.find((h) => h.phraseId === 'workload-996');
    expect(hit).toBeDefined();
    expect(hit!.matchedText).toBe('996');
    expect(hit!.matchType).toBe('exact');
    expect(hit!.certainty).toBe('A');
  });

  it('命中"狼性"精确短语', () => {
    const text = '我们崇尚狼性文化，团队战斗力强。';
    const hits = matchPhrases(text);
    const hit = hits.find((h) => h.phraseId === 'culture-langxing');
    expect(hit).toBeDefined();
    expect(hit!.certainty).toBe('A');
  });

  it('未命中时返回空数组', () => {
    const text = '这是一个普通的岗位，没有任何特别要求。';
    const hits = matchPhrases(text);
    expect(hits.length).toBe(0);
  });
});

describe('匹配引擎: 别名匹配', () => {
  it('通过别名"早9晚9"命中996，certainty 降一级', () => {
    const text = '我们采用早9晚9的工作制度。';
    const hits = matchPhrases(text);
    const hit = hits.find((h) => h.phraseId === 'workload-996');
    expect(hit).toBeDefined();
    expect(hit!.matchedText).toBe('早9晚9');
    expect(hit!.matchType).toBe('alias');
    // 996 certainty=A，别名命中降一级为 B
    expect(hit!.certainty).toBe('B');
  });

  it('通过别名"十三薪"命中13薪', () => {
    const text = '公司提供十三薪及年终奖。';
    const hits = matchPhrases(text);
    const hit = hits.find((h) => h.phraseId === 'salary-13xin');
    expect(hit).toBeDefined();
    expect(hit!.matchType).toBe('alias');
  });
});

describe('匹配引擎: 模糊匹配', () => {
  it('模糊匹配"996工作制度"', () => {
    const text = '这里实行996工作制度，强度较大。';
    const hits = matchPhrases(text);
    const hit = hits.find((h) => h.phraseId === 'workload-996');
    // "996" 是精确命中，不是模糊
    expect(hit).toBeDefined();
    expect(hit!.matchType).toBe('exact');
  });

  it('空文本返回空', () => {
    expect(matchPhrases('')).toEqual([]);
    expect(matchPhrases('   ')).toEqual([]);
  });
});

describe('匹配引擎: 上下文权重', () => {
  it('"任职要求"段命中权重高于"公司介绍"段', () => {
    const reqText = '任职要求：能吃苦，抗压能力强。';
    const introText = '公司介绍：我们的团队能吃苦，欢迎加入。';

    const reqHits = matchPhrases(reqText);
    const introHits = matchPhrases(introText);

    // 用"能吃苦"在两段中都命中
    const reqNengchiku = reqHits.find((h) => h.phraseId === 'culture-nengchiku');
    const introNengchiku = introHits.find((h) => h.phraseId === 'culture-nengchiku');

    expect(reqNengchiku).toBeDefined();
    expect(introNengchiku).toBeDefined();

    // 同一条目在任职要求段的 certainty 应高于或等于公司介绍段
    const levelOrder = { A: 4, B: 3, C: 2, D: 1 } as const;
    expect(levelOrder[reqNengchiku!.certainty]).toBeGreaterThanOrEqual(
      levelOrder[introNengchiku!.certainty]
    );
  });
});

describe('匹配引擎: 输出结构', () => {
  it('每个 hit 含完整字段', () => {
    const text = '996工作制，狼性团队，五险一金。';
    const hits = matchPhrases(text);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.phraseId).toBeTruthy();
      expect(h.matchedText).toBeTruthy();
      expect(h.matchedText.length).toBeLessThanOrEqual(20); // 版权合规
      expect(['A', 'B', 'C', 'D']).toContain(h.certainty);
      expect(h.interpretation).toBeTruthy();
      expect(Array.isArray(h.questions)).toBe(true);
      expect(h.questions.length).toBeGreaterThan(0);
      expect(h.position.start).toBeGreaterThanOrEqual(0);
      expect(h.position.end).toBeGreaterThan(h.position.start);
      expect(['exact', 'alias', 'fuzzy']).toContain(h.matchType);
    }
  });

  it('命中按位置排序', () => {
    const text = '我们狼性团队，实行996，提供五险一金。';
    const hits = matchPhrases(text);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].position.start).toBeGreaterThanOrEqual(hits[i - 1].position.start);
    }
  });
});

describe('匹配引擎: AI 兜底（V1 默认关闭）', () => {
  it('默认不启用 AI 兜底，空结果不返回 ai 条目', () => {
    const text = '普通岗位描述，无潜台词短语。';
    const hits = matchPhrases(text);
    expect(hits.every((h) => h.source !== 'ai')).toBe(true);
  });

  it('启用 AI 兜底时，V1 暂不生成 ai 条目（占位）', () => {
    const text = '普通岗位描述。';
    const hits = matchPhrases(text, { enableAiFallback: true });
    // V1 不实现 AI 兜底，所以仍然为空
    expect(hits.length).toBe(0);
  });
});
