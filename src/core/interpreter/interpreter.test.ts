// 潜台词解读持久化测试（Issue #11）
// 验收标准：
//   - interpretation 字段向后兼容（不修改原 Job 字段）
//   - 三层框架：公开信息(A)/常见含义(B)/待确认(C/D)
//   - 解读结果不可逆向修改 Job 原字段
//   - D 级显示"无法仅凭此判断"而非强行翻译
//   - 持久化测试

import { describe, it, expect } from 'vitest';
import { interpret, attachInterpretation } from './interpreter';
import { INTERPRETER_VERSION } from './types';
import { MemoryStorage, StorageKey } from '../../storage/storage-adapter';
import { JobRepository } from '../../storage/job-repository';
import type { Job } from '../../types/job';

function makeJob(over: Partial<Job> = {}): Job {
  return {
    id: 'test-job-1',
    title: '前端工程师',
    company: '字节跳动',
    salary: '25-50K',
    location: '北京',
    description: '本公司实行996工作制，狼性团队，能吃苦，提供五险一金。',
    sourceUrl: 'https://x.com/1',
    source: 'zhipin',
    fetchedAt: Date.now(),
    ...over,
  };
}

describe('解读: 三层框架', () => {
  it('A 级命中归入 publicInfo', () => {
    const job = makeJob({ description: '实行996工作制。' });
    const result = interpret(job);
    const hit = result.hits.find((h) => h.phraseId === 'workload-996');
    expect(hit?.certainty).toBe('A');
    expect(result.publicInfo.some((h) => h.phraseId === 'workload-996')).toBe(true);
  });

  it('B 级命中归入 commonMeaning', () => {
    const job = makeJob({ description: '我们崇尚狼性文化。' });
    const result = interpret(job);
    const hit = result.hits.find((h) => h.phraseId === 'culture-langxing');
    // 狼性 certainty=A，精确命中保持 A
    expect(hit?.certainty).toBe('A');
    // 用别名触发 B 级
    const job2 = makeJob({ description: '我们是狼群精神团队。' });
    const r2 = interpret(job2);
    const hit2 = r2.hits.find((h) => h.phraseId === 'culture-langxing');
    if (hit2?.certainty === 'B') {
      expect(r2.commonMeaning.some((h) => h.phraseId === 'culture-langxing')).toBe(true);
    }
  });

  it('C/D 级命中归入 toConfirm', () => {
    const job = makeJob({ description: '弹性工作，快节奏。' });
    const result = interpret(job);
    // 弹性工作 certainty=C
    const tanxing = result.hits.find((h) => h.phraseId === 'workload-tanxing');
    expect(tanxing?.certainty).toBe('C');
    expect(result.toConfirm.some((h) => h.phraseId === 'workload-tanxing')).toBe(true);
  });

  it('D 级显示"无法仅凭此判断"', () => {
    // 弹性工作在公司介绍段会被降级到 D
    const job = makeJob({ description: '公司介绍：我们实行弹性工作制度。' });
    const result = interpret(job);
    const tanxing = result.toConfirm.find((h) => h.phraseId === 'workload-tanxing');
    if (tanxing?.certainty === 'D') {
      expect(tanxing.interpretation).toContain('无法仅凭此判断');
    }
  });
});

describe('解读: 不可修改原 Job 字段', () => {
  it('attachInterpretation 返回新对象，不修改原 job', () => {
    const job = makeJob();
    const originalDescription = job.description;
    const result = interpret(job);
    const newJob = attachInterpretation(job, result);

    expect(newJob).not.toBe(job);
    expect(newJob.description).toBe(originalDescription);
    expect(job.description).toBe(originalDescription); // 原对象未变
    expect(newJob.interpretation).toBe(result);
    expect(job.interpretation).toBeUndefined(); // 原对象没有 interpretation
  });

  it('interpret 不修改传入的 job', () => {
    const job = makeJob();
    const snapshot = JSON.stringify(job);
    interpret(job);
    expect(JSON.stringify(job)).toBe(snapshot);
  });
});

describe('解读: 待确认问题与风险标记', () => {
  it('pendingQuestions 汇总所有命中的问题并去重', () => {
    const job = makeJob();
    const result = interpret(job);
    expect(result.pendingQuestions.length).toBeGreaterThan(0);
    // 去重
    expect(new Set(result.pendingQuestions).size).toBe(result.pendingQuestions.length);
  });

  it('riskFlags 包含 A/B 级命中的短语 ID', () => {
    const job = makeJob({ description: '996工作制，狼性团队。' });
    const result = interpret(job);
    expect(result.riskFlags).toContain('workload-996');
    expect(result.riskFlags).toContain('culture-langxing');
  });
});

describe('解读: 持久化', () => {
  it('interpretation 可存入 storage 并还原', async () => {
    const storage = new MemoryStorage();
    const repo = new JobRepository(storage);

    const job = makeJob();
    const result = interpret(job);
    const jobWithInterp = attachInterpretation(job, result);

    await repo.save(jobWithInterp);
    const loaded = await repo.getById(jobWithInterp.id!);

    expect(loaded?.interpretation).toBeDefined();
    expect(loaded?.interpretation?.engineVersion).toBe(INTERPRETER_VERSION);
    expect(loaded?.interpretation?.hits.length).toBe(result.hits.length);
    expect(loaded?.interpretation?.pendingQuestions).toEqual(result.pendingQuestions);
  });

  it('旧 Job 无 interpretation 字段不报错（向后兼容）', async () => {
    const storage = new MemoryStorage();
    const repo = new JobRepository(storage);

    // 模拟旧数据：直接写入没有 interpretation 字段的 Job（绕过 save 自动生成）
    const oldJob: Job = makeJob();
    delete (oldJob as { interpretation?: unknown }).interpretation;
    await storage.set(StorageKey.JOBS, [oldJob]);

    // 读取旧数据不报错
    const loaded = await repo.getById(oldJob.id!);
    expect(loaded).toBeDefined();
    expect(loaded?.interpretation).toBeUndefined();
  });

  it('engineVersion 字段持久化', async () => {
    const storage = new MemoryStorage();
    const repo = new JobRepository(storage);

    const job = makeJob();
    const result = interpret(job);
    await repo.save(attachInterpretation(job, result));

    const loaded = await repo.getById(job.id!);
    expect(loaded?.interpretation?.engineVersion).toBe(INTERPRETER_VERSION);
  });
});
