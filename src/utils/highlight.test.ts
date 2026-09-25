// 原文高亮工具测试（Issue #12）

import { describe, it, expect } from 'vitest';
import { splitByHits } from './highlight';
import type { InterpretationHit } from '../core/interpreter/matcher';

function makeHit(start: number, end: number, certainty = 'A'): InterpretationHit {
  return {
    phraseId: 'test',
    matchedText: 'X',
    category: 'WORKLOAD',
    certainty: certainty as 'A',
    interpretation: '解读',
    questions: [],
    position: { start, end },
    matchType: 'exact',
    source: 'curated',
  };
}

describe('splitByHits', () => {
  it('无命中时返回单段普通文本', () => {
    const segs = splitByHits('hello world', []);
    expect(segs).toEqual([{ text: 'hello world', highlight: false }]);
  });

  it('空文本返回单段空文本', () => {
    const segs = splitByHits('', [makeHit(0, 2)]);
    expect(segs).toEqual([{ text: '', highlight: false }]);
  });

  it('单个命中正确切分', () => {
    const text = '我们实行996工作制';
    const hits = [makeHit(4, 7)]; // '996'
    const segs = splitByHits(text, hits);
    expect(segs.length).toBe(3);
    expect(segs[0]).toEqual({ text: '我们实行', highlight: false });
    expect(segs[1]).toEqual({ text: '996', highlight: true, certainty: 'A' });
    expect(segs[2]).toEqual({ text: '工作制', highlight: false });
  });

  it('多个命中按位置排序切分', () => {
    // '996和狼性文化'：996 在 0-3，狼性 在 4-6
    const text = '996和狼性文化';
    const hits = [makeHit(4, 6), makeHit(0, 3)]; // 乱序传入
    const segs = splitByHits(text, hits);
    expect(segs[0].text).toBe('996');
    expect(segs[0].highlight).toBe(true);
    expect(segs[1].text).toBe('和');
    expect(segs[2].text).toBe('狼性');
    expect(segs[2].highlight).toBe(true);
    expect(segs[3].text).toBe('文化');
  });

  it('越界命中被跳过', () => {
    const text = '短文本';
    const hits = [makeHit(10, 20)];
    const segs = splitByHits(text, hits);
    expect(segs).toEqual([{ text: '短文本', highlight: false }]);
  });
});
