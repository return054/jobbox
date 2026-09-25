// JobRepository 单元测试
// 覆盖：
//   1. CRUD 全流程（save/getById/saveAll/delete/clear/count）
//   2. upsert 语义（相同 id 覆盖，不重复）
//   3. 1000 条数据搜索性能（Issue #5 验收：无明显卡顿）
//   4. 搜索条件组合（keyword/city/salary/limit/offset）

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from './storage-adapter';
import { JobRepository, hashIdOf } from './job-repository';
import type { Job } from '../types/job';
import type { NormalizedJob } from '../core/normalizer/types';

function makeJob(over: Partial<Job> = {}): Job {
  return {
    title: '前端工程师',
    company: '字节跳动',
    salary: '25-50K·14薪',
    location: '北京·朝阳区·望京',
    description: '负责 Web 前端开发',
    sourceUrl: 'https://example.com/job/1',
    source: 'generic',
    fetchedAt: Date.now(),
    ...over,
  };
}

const normalizedBeijing: NormalizedJob = {
  salary: { raw: '25-50K·14薪', min: 25000, max: 50000, unit: 'MONTH', months: 14, parsed: true },
  location: { raw: '北京·朝阳区', province: '北京', city: '北京', district: '朝阳区', parsed: true },
  education: { raw: '本科', level: '本科', parsed: true },
  experience: { raw: '3-5年', min: 3, max: 5, unit: 'YEAR', parsed: true },
};

describe('hashIdOf', () => {
  it('已有 id 直接返回', () => {
    expect(hashIdOf({ id: 'abc' })).toBe('abc');
  });
  it('缺 id 用 sourceUrl hash', () => {
    const a = hashIdOf({ sourceUrl: 'https://x.com/1' });
    const b = hashIdOf({ sourceUrl: 'https://x.com/1' });
    const c = hashIdOf({ sourceUrl: 'https://x.com/2' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('u_')).toBe(true);
  });
});

describe('JobRepository', () => {
  let storage: MemoryStorage;
  let repo: JobRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new JobRepository(storage);
  });

  describe('CRUD', () => {
    it('空仓库 getAll 返回空数组', async () => {
      expect(await repo.getAll()).toEqual([]);
      expect(await repo.count()).toBe(0);
    });

    it('save 单条 + getById 读取', async () => {
      const job = makeJob();
      await repo.save(job);
      const id = hashIdOf(job);
      const got = await repo.getById(id);
      expect(got).not.toBeNull();
      expect(got?.id).toBe(id);
      expect(got?.title).toBe('前端工程师');
      expect(await repo.count()).toBe(1);
    });

    it('save 缺 id 的 Job 时自动补 id', async () => {
      const job = makeJob();
      expect(job.id).toBeUndefined();
      await repo.save(job);
      const all = await repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBeDefined();
    });

    it('save 相同 id 的 Job 是 upsert（覆盖不重复）', async () => {
      const job = makeJob();
      await repo.save(job);
      const id = hashIdOf(job);
      // 同 id 但 title 改了
      await repo.save({ ...job, title: '高级前端工程师' });
      const all = await repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe('高级前端工程师');
      const got = await repo.getById(id);
      expect(got?.title).toBe('高级前端工程师');
    });

    it('saveAll 批量写入（upsert 语义）', async () => {
      const a = makeJob({ sourceUrl: 'https://x.com/1' });
      const b = makeJob({ sourceUrl: 'https://x.com/2' });
      const c = makeJob({ sourceUrl: 'https://x.com/3' });
      await repo.saveAll([a, b, c]);
      expect(await repo.count()).toBe(3);
      // 再批量写入：b 同 id 覆盖，d 新增
      const b2 = makeJob({ sourceUrl: 'https://x.com/2', title: '改了' });
      const d = makeJob({ sourceUrl: 'https://x.com/4' });
      await repo.saveAll([b2, d]);
      expect(await repo.count()).toBe(4);
      const b2id = hashIdOf(b2);
      const got = await repo.getById(b2id);
      expect(got?.title).toBe('改了');
    });

    it('saveAll 空数组是 no-op', async () => {
      await repo.saveAll([]);
      expect(await repo.count()).toBe(0);
    });

    it('delete 删除单条', async () => {
      const job = makeJob();
      await repo.save(job);
      const id = hashIdOf(job);
      expect(await repo.count()).toBe(1);
      await repo.delete(id);
      expect(await repo.count()).toBe(0);
      expect(await repo.getById(id)).toBeNull();
    });

    it('delete 不存在的 id 是 no-op', async () => {
      const job = makeJob();
      await repo.save(job);
      await repo.delete('not-exist');
      expect(await repo.count()).toBe(1);
    });

    it('clear 清空全部', async () => {
      await repo.saveAll([makeJob({ sourceUrl: 'a' }), makeJob({ sourceUrl: 'b' })]);
      expect(await repo.count()).toBe(2);
      await repo.clear();
      expect(await repo.count()).toBe(0);
      expect(await repo.getAll()).toEqual([]);
    });

    it('getById 不存在返回 null', async () => {
      expect(await repo.getById('not-exist')).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // 准备 5 条不同数据
      const base = Date.now();
      const jobs: Job[] = [
        makeJob({
          title: '高级前端工程师',
          company: '字节跳动',
          sourceUrl: 'https://x.com/1',
          description: 'React/TypeScript',
          location: '北京·朝阳区',
          fetchedAt: base + 1,
          normalized: normalizedBeijing,
        }),
        makeJob({
          title: 'Java 后端',
          company: '阿里巴巴',
          sourceUrl: 'https://x.com/2',
          description: 'Spring Boot',
          location: '杭州余杭区',
          fetchedAt: base + 2,
          normalized: {
            ...normalizedBeijing,
            location: { raw: '杭州', province: '浙江', city: '杭州', district: '余杭区', parsed: true },
            salary: { raw: '20-40K', min: 20000, max: 40000, unit: 'MONTH', months: 12, parsed: true },
          },
        }),
        makeJob({
          title: '前端工程师',
          company: '腾讯',
          sourceUrl: 'https://x.com/3',
          description: 'Vue 全家桶',
          location: '深圳南山',
          fetchedAt: base + 3,
          normalized: {
            ...normalizedBeijing,
            location: { raw: '深圳', province: '广东', city: '深圳', district: '南山区', parsed: true },
            salary: { raw: '15-30K', min: 15000, max: 30000, unit: 'MONTH', months: 12, parsed: true },
          },
        }),
      ];
      await repo.saveAll(jobs);
    });

    it('无条件的 search 返回 limit 内全部（按 fetchedAt 倒序）', async () => {
      const result = await repo.search({});
      expect(result).toHaveLength(3);
      expect(result[0].sourceUrl).toBe('https://x.com/3');
      expect(result[2].sourceUrl).toBe('https://x.com/1');
    });

    it('keyword 命中 title', async () => {
      const r = await repo.search({ keyword: '前端' });
      expect(r).toHaveLength(2);
      const urls = r.map((j) => j.sourceUrl).sort();
      expect(urls).toEqual(['https://x.com/1', 'https://x.com/3']);
    });

    it('keyword 命中 company', async () => {
      const r = await repo.search({ keyword: '字节' });
      expect(r).toHaveLength(1);
      expect(r[0].company).toBe('字节跳动');
    });

    it('keyword 命中 description', async () => {
      const r = await repo.search({ keyword: 'Spring' });
      expect(r).toHaveLength(1);
      expect(r[0].company).toBe('阿里巴巴');
    });

    it('city 走 normalized.location.city 精确匹配', async () => {
      const r = await repo.search({ city: '北京' });
      expect(r).toHaveLength(1);
      expect(r[0].company).toBe('字节跳动');
    });

    it('city 未命中的返回空', async () => {
      const r = await repo.search({ city: '上海' });
      expect(r).toHaveLength(0);
    });

    it('salaryMin 过滤：岗位下限 < 查询下限则排除', async () => {
      // salaryMin=20000：北京(min=25000)✓ + 杭州(min=20000)✓，深圳(min=15000)✗
      const r = await repo.search({ salaryMin: 20000 });
      expect(r).toHaveLength(2);
      const companies = r.map((j) => j.company).sort();
      expect(companies).toEqual(['字节跳动', '阿里巴巴']);
    });

    it('salaryMax 过滤：岗位上限 > 查询上限则排除', async () => {
      // salaryMax=30000：深圳(max=30000)✓，杭州(max=40000)✗，北京(max=50000)✗
      const r = await repo.search({ salaryMax: 30000 });
      expect(r).toHaveLength(1);
      expect(r[0].company).toBe('腾讯');
    });

    it('salaryMin + salaryMax 范围', async () => {
      // min>=20000 且 max<=40000：杭州(min=20000,max=40000) 命中
      // 北京 max=50000 超过 40000 排除；深圳 min=15000 不达 20000 排除
      const r = await repo.search({ salaryMin: 20000, salaryMax: 40000 });
      expect(r).toHaveLength(1);
      expect(r[0].company).toBe('阿里巴巴');
    });

    it('keyword + city 组合', async () => {
      const r = await repo.search({ keyword: '前端', city: '深圳' });
      expect(r).toHaveLength(1);
      expect(r[0].company).toBe('腾讯');
    });

    it('limit 截断', async () => {
      const r = await repo.search({ limit: 2 });
      expect(r).toHaveLength(2);
      // 倒序的前 2 条
      expect(r[0].sourceUrl).toBe('https://x.com/3');
      expect(r[1].sourceUrl).toBe('https://x.com/2');
    });

    it('offset 分页', async () => {
      const r = await repo.search({ offset: 2, limit: 10 });
      expect(r).toHaveLength(1);
      expect(r[0].sourceUrl).toBe('https://x.com/1');
    });

    it('normalized 缺失的 Job 不参与薪资过滤（不被薪资过滤删除）', async () => {
      await repo.save(
        makeJob({
          sourceUrl: 'https://x.com/no-norm',
          title: '无归一化岗位',
          normalized: undefined,
        })
      );
      // 薪资过滤下，无 normalized 的岗位应该保留（避免误删）
      const r = await repo.search({ salaryMin: 999999 });
      expect(r.some((j) => j.sourceUrl === 'https://x.com/no-norm')).toBe(true);
    });
  });

  describe('性能：1000 条数据搜索（Issue #5 验收）', () => {
    it('1000 条全字段过滤在合理时间内完成', async () => {
      // 准备 1000 条
      const base = Date.now();
      const jobs: Job[] = Array.from({ length: 1000 }, (_, i) =>
        makeJob({
          title: `岗位-${i % 50}`,
          company: `公司-${i % 20}`,
          sourceUrl: `https://x.com/${i}`,
          description: `描述-${i} ${i % 7 === 0 ? '前端' : '后端'}`,
          location: i % 2 === 0 ? '北京' : '杭州',
          fetchedAt: base + i,
          normalized:
            i % 2 === 0
              ? normalizedBeijing
              : {
                  ...normalizedBeijing,
                  location: { raw: '杭州', province: '浙江', city: '杭州', district: '余杭区', parsed: true },
                  salary: { raw: `${10 + (i % 30)}-${20 + (i % 30)}K`, min: 10000 + (i % 30) * 1000, max: 20000 + (i % 30) * 1000, unit: 'MONTH' as const, months: 12, parsed: true },
                },
        })
      );
      await repo.saveAll(jobs);
      expect(await repo.count()).toBe(1000);

      // 触发搜索：keyword + city + salary 三条件
      const start = performance.now();
      const r = await repo.search({
        keyword: '前端',
        city: '北京',
        salaryMin: 20000,
        salaryMax: 60000,
        limit: 50,
      });
      const elapsed = performance.now() - start;

      // 期望不抛错且结果数量受 limit 控制
      expect(r.length).toBeLessThanOrEqual(50);
      // 1000 条内存过滤 < 200ms（远低于"卡顿"阈值 16ms 一帧）
      // 这里取宽松上界 200ms，避免 CI 抖动
      expect(elapsed).toBeLessThan(200);
    });

    it('1000 条 count 与 getAll 一致', async () => {
      const jobs = Array.from({ length: 1000 }, (_, i) =>
        makeJob({ sourceUrl: `https://x.com/c/${i}` })
      );
      await repo.saveAll(jobs);
      expect(await repo.count()).toBe(1000);
      expect((await repo.getAll()).length).toBe(1000);
    });

    it('1000 条数据下重复 saveAll 不产生重复记录', async () => {
      const jobs = Array.from({ length: 1000 }, (_, i) =>
        makeJob({ sourceUrl: `https://x.com/d/${i}` })
      );
      await repo.saveAll(jobs);
      await repo.saveAll(jobs); // 再写入一次（同 id）
      expect(await repo.count()).toBe(1000);
    });
  });

  describe('持久化（MemoryStorage 模拟）', () => {
    it('写入后重启实例仍能读到（共享同一 storage）', async () => {
      await repo.save(makeJob({ sourceUrl: 'https://x.com/persist' }));
      // 模拟"重新创建 repo"：用同一个 storage 实例
      const repo2 = new JobRepository(storage);
      const all = await repo2.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].sourceUrl).toBe('https://x.com/persist');
    });

    it('不同 storage 实例互不干扰', async () => {
      const storage1 = new MemoryStorage();
      const storage2 = new MemoryStorage();
      const r1 = new JobRepository(storage1);
      const r2 = new JobRepository(storage2);
      await r1.save(makeJob({ sourceUrl: 'https://x.com/a' }));
      await r2.save(makeJob({ sourceUrl: 'https://x.com/b' }));
      expect(await r1.count()).toBe(1);
      expect(await r2.count()).toBe(1);
      expect((await r1.getAll())[0].sourceUrl).toBe('https://x.com/a');
      expect((await r2.getAll())[0].sourceUrl).toBe('https://x.com/b');
    });
  });
});
