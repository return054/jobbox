// Stage 5 仓储扩展测试
// 覆盖：状态/标签/备注操作 + 扩展搜索（education/experience/status/tags/source）
// 验收重点：自动标签与用户标签分离存储

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from './storage-adapter';
import { JobRepository, hashIdOf } from './job-repository';
import type { Job } from '../types/job';
import type { NormalizedJob } from '../core/normalizer/types';

function makeJob(over: Partial<Job> = {}): Job {
  return {
    title: '前端工程师',
    company: '字节跳动',
    salary: '25-50K',
    location: '北京',
    description: 'React 开发',
    sourceUrl: 'https://x.com/1',
    source: 'generic',
    fetchedAt: Date.now(),
    ...over,
  };
}

const normalized: NormalizedJob = {
  salary: { raw: '25-50K', min: 25000, max: 50000, unit: 'MONTH', months: 12, parsed: true },
  location: { raw: '北京', province: '北京', city: '北京', district: '', parsed: true },
  education: { raw: '本科', level: '本科', parsed: true },
  experience: { raw: '3-5年', min: 3, max: 5, unit: 'YEAR', parsed: true },
};

describe('Stage 5: 状态操作', () => {
  let storage: MemoryStorage;
  let repo: JobRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new JobRepository(storage);
  });

  it('updateStatus 修改状态并更新 updatedAt', async () => {
    const job = makeJob();
    await repo.save(job);
    const id = hashIdOf(job);
    const before = (await repo.getById(id))!.updatedAt;

    // 给一点时间确保时间戳不同
    await new Promise((r) => setTimeout(r, 5));
    const updated = await repo.updateStatus(id, 'applied');
    expect(updated?.status).toBe('applied');
    expect(updated!.updatedAt!).toBeGreaterThan(before!);
    expect((await repo.getById(id))!.status).toBe('applied');
  });

  it('updateStatus 设为相同值时不写回（无变化优化）', async () => {
    const job = makeJob({ status: 'saved' });
    await repo.save(job);
    const id = hashIdOf(job);
    const before = (await repo.getById(id))!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const updated = await repo.updateStatus(id, 'saved');
    expect(updated?.updatedAt).toBe(before);
  });

  it('updateStatus 不存在的 id 返回 null', async () => {
    expect(await repo.updateStatus('not-exist', 'applied')).toBeNull();
  });

  it('search 按 status 过滤', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', status: 'saved' }),
      makeJob({ sourceUrl: 'b', status: 'applied' }),
      makeJob({ sourceUrl: 'c', status: 'interview' }),
    ]);
    const r = await repo.search({ status: 'applied' });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('b');
  });

  it('未设置 status 的岗位默认按 saved 过滤', async () => {
    await repo.save(makeJob({ sourceUrl: 'no-status' }));
    const r = await repo.search({ status: 'saved' });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('no-status');
  });
});

describe('Stage 5: 标签操作（用户标签 vs 自动标签分离）', () => {
  let storage: MemoryStorage;
  let repo: JobRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new JobRepository(storage);
  });

  it('addTag 添加用户标签', async () => {
    const job = makeJob();
    await repo.save(job);
    const id = hashIdOf(job);
    await repo.addTag(id, '心仪');
    const got = await repo.getById(id);
    expect(got?.tags).toEqual(['心仪']);
  });

  it('addTag 自动去重', async () => {
    const job = makeJob();
    await repo.save(job);
    const id = hashIdOf(job);
    await repo.addTag(id, '心仪');
    await repo.addTag(id, '心仪');
    expect((await repo.getById(id))!.tags).toEqual(['心仪']);
  });

  it('addTag 忽略空白字符串', async () => {
    const job = makeJob();
    await repo.save(job);
    const id = hashIdOf(job);
    const r = await repo.addTag(id, '   ');
    expect(r).toBeNull();
    expect((await repo.getById(id))!.tags).toBeUndefined();
  });

  it('removeTag 移除用户标签', async () => {
    const job = makeJob({ tags: ['心仪', '远程'] });
    await repo.save(job);
    const id = hashIdOf(job);
    await repo.removeTag(id, '远程');
    expect((await repo.getById(id))!.tags).toEqual(['心仪']);
  });

  it('setTags 全量替换（去重+去空白）', async () => {
    const job = makeJob({ tags: ['旧标签'] });
    await repo.save(job);
    const id = hashIdOf(job);
    await repo.setTags(id, ['新标签', '  ', '新标签', '第二个']);
    expect((await repo.getById(id))!.tags).toEqual(['新标签', '第二个']);
  });

  it('setAutoTags 设置自动标签，不影响用户标签（分离存储）', async () => {
    const job = makeJob({ tags: ['我的标签'] });
    await repo.save(job);
    const id = hashIdOf(job);
    await repo.setAutoTags(id, ['996风险', '高薪']);
    const got = await repo.getById(id);
    // 两个字段独立存储
    expect(got?.tags).toEqual(['我的标签']);
    expect(got?.autoTags).toEqual(['996风险', '高薪']);
  });

  it('setAutoTags 与 setTags 互不覆盖', async () => {
    const job = makeJob();
    await repo.save(job);
    const id = hashIdOf(job);
    await repo.setAutoTags(id, ['auto1']);
    await repo.setTags(id, ['user1']);
    const got = await repo.getById(id);
    expect(got?.autoTags).toEqual(['auto1']);
    expect(got?.tags).toEqual(['user1']);
  });

  it('search 按用户标签过滤（OR 语义）', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', tags: ['心仪', '远程'] }),
      makeJob({ sourceUrl: 'b', tags: ['高薪'] }),
      makeJob({ sourceUrl: 'c', tags: ['远程', '实习'] }),
    ]);
    const r = await repo.search({ tags: ['远程'] });
    expect(r).toHaveLength(2);
    const urls = r.map((j) => j.sourceUrl).sort();
    expect(urls).toEqual(['a', 'c']);
  });

  it('search 标签过滤只匹配用户标签，不匹配自动标签', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', autoTags: ['996风险'] }),
      makeJob({ sourceUrl: 'b', tags: ['996风险'] }),
    ]);
    // 按 '996风险' 过滤：a 的 autoTags 不算，只有 b 的 user tags 命中
    const r = await repo.search({ tags: ['996风险'] });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('b');
  });

  it('keyword 搜索同时匹配用户标签和自动标签', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', autoTags: ['高薪'] }),
      makeJob({ sourceUrl: 'b', tags: ['心仪'] }),
      makeJob({ sourceUrl: 'c' }),
    ]);
    expect((await repo.search({ keyword: '高薪' })).length).toBe(1);
    expect((await repo.search({ keyword: '心仪' })).length).toBe(1);
  });
});

describe('Stage 5: 备注操作', () => {
  let storage: MemoryStorage;
  let repo: JobRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new JobRepository(storage);
  });

  it('updateNotes 写入备注', async () => {
    const job = makeJob();
    await repo.save(job);
    const id = hashIdOf(job);
    await repo.updateNotes(id, '面试感觉不错');
    expect((await repo.getById(id))!.notes).toBe('面试感觉不错');
  });

  it('updateNotes 设为相同值不写回', async () => {
    const job = makeJob({ notes: '相同' });
    await repo.save(job);
    const id = hashIdOf(job);
    const before = (await repo.getById(id))!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await repo.updateNotes(id, '相同');
    expect((await repo.getById(id))!.updatedAt).toBe(before);
  });

  it('keyword 搜索匹配备注', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', notes: '面试官很友好' }),
      makeJob({ sourceUrl: 'b', notes: '薪资太低' }),
    ]);
    const r = await repo.search({ keyword: '友好' });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('a');
  });
});

describe('Stage 5: 扩展搜索（education/experience/source）', () => {
  let storage: MemoryStorage;
  let repo: JobRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new JobRepository(storage);
  });

  it('search 按 education 过滤', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', normalized: { ...normalized, education: { raw: '本科', level: '本科', parsed: true } } }),
      makeJob({ sourceUrl: 'b', normalized: { ...normalized, education: { raw: '硕士', level: '硕士', parsed: true } } }),
    ]);
    const r = await repo.search({ education: '硕士' });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('b');
  });

  it('search 按 experienceMin 过滤', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', normalized: { ...normalized, experience: { raw: '1-3年', min: 1, max: 3, unit: 'YEAR', parsed: true } } }),
      makeJob({ sourceUrl: 'b', normalized: { ...normalized, experience: { raw: '5-10年', min: 5, max: 10, unit: 'YEAR', parsed: true } } }),
    ]);
    const r = await repo.search({ experienceMin: 3 });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('b');
  });

  it('search 按 experienceMax 过滤（max=0 不限不参与）', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', normalized: { ...normalized, experience: { raw: '经验不限', min: 0, max: 0, unit: 'YEAR', parsed: true } } }),
      makeJob({ sourceUrl: 'b', normalized: { ...normalized, experience: { raw: '3-5年', min: 3, max: 5, unit: 'YEAR', parsed: true } } }),
    ]);
    // experienceMax=3：a 的 max=0（不限）不参与过滤 → 保留；b 的 max=5 > 3 → 排除
    const r = await repo.search({ experienceMax: 3 });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('a');
  });

  it('search 按 source 过滤', async () => {
    await repo.saveAll([
      makeJob({ sourceUrl: 'a', source: 'zhipin' }),
      makeJob({ sourceUrl: 'b', source: 'lagou' }),
    ]);
    const r = await repo.search({ source: 'zhipin' });
    expect(r).toHaveLength(1);
    expect(r[0].source).toBe('zhipin');
  });

  it('多条件组合搜索', async () => {
    await repo.saveAll([
      makeJob({
        sourceUrl: 'a',
        source: 'zhipin',
        status: 'applied',
        tags: ['心仪'],
        normalized,
      }),
      makeJob({
        sourceUrl: 'b',
        source: 'lagou',
        status: 'saved',
        normalized,
      }),
    ]);
    const r = await repo.search({
      source: 'zhipin',
      status: 'applied',
      tags: ['心仪'],
      city: '北京',
    });
    expect(r).toHaveLength(1);
    expect(r[0].sourceUrl).toBe('a');
  });
});

describe('Stage 5: 1000 条带状态/标签搜索性能', () => {
  it('1000 条多条件搜索 < 200ms', async () => {
    const storage = new MemoryStorage();
    const repo = new JobRepository(storage);
    const base = Date.now();
    const jobs: Job[] = Array.from({ length: 1000 }, (_, i) =>
      makeJob({
        sourceUrl: `https://x.com/${i}`,
        title: `岗位-${i}`,
        status: (['saved', 'applied', 'interview', 'rejected', 'offer'] as const)[i % 5],
        tags: i % 3 === 0 ? ['心仪'] : [],
        normalized:
          i % 2 === 0
            ? normalized
            : { ...normalized, education: { raw: '硕士', level: '硕士', parsed: true } },
        fetchedAt: base + i,
      })
    );
    await repo.saveAll(jobs);

    const start = performance.now();
    const r = await repo.search({
      keyword: '岗位',
      status: 'applied',
      tags: ['心仪'],
      education: '硕士',
      limit: 50,
    });
    const elapsed = performance.now() - start;

    expect(r.length).toBeLessThanOrEqual(50);
    expect(elapsed).toBeLessThan(200);
  });
});
