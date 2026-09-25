// Storage 层综合测试：settings + migration + import/export
// 覆盖 Issue #5 验收：
//   - 刷新后数据持久（MemoryStorage 共享 + 迁移幂等）
//   - 导出 JSON 可再导入还原

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage, StorageKey } from './storage-adapter';
import { SettingsRepository, DEFAULT_SETTINGS } from './settings-repository';
import { JobRepository } from './job-repository';
import {
  CURRENT_SCHEMA_VERSION,
  migrate,
  isInitialized,
} from './migration';
import {
  exportAll,
  importAll,
  serializePayload,
  parsePayload,
} from './import-export';
import type { Job } from '../types/job';
import type { Settings } from './settings-repository';

function makeJob(over: Partial<Job> = {}): Job {
  return {
    title: '前端工程师',
    company: '字节跳动',
    salary: '25-50K',
    location: '北京',
    description: '前端开发',
    sourceUrl: 'https://x.com/1',
    source: 'generic',
    fetchedAt: Date.now(),
    ...over,
  };
}

describe('SettingsRepository', () => {
  let storage: MemoryStorage;
  let repo: SettingsRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new SettingsRepository(storage);
  });

  it('空仓库 getAll 返回 DEFAULT_SETTINGS', async () => {
    const all = await repo.getAll();
    expect(all).toEqual(DEFAULT_SETTINGS);
    expect(all.autoPassThreshold).toBe(90);
    expect(all.reviewThreshold).toBe(70);
    expect(all.maxJobs).toBe(1000);
    expect(all.enableInterpretation).toBe(false);
  });

  it('get 单字段返回默认值', async () => {
    expect(await repo.get('autoPassThreshold')).toBe(90);
    expect(await repo.get('reviewThreshold')).toBe(70);
    expect(await repo.get('maxJobs')).toBe(1000);
    expect(await repo.get('enableInterpretation')).toBe(false);
  });

  it('set 单字段后 get 读到新值（其他字段不变）', async () => {
    await repo.set('autoPassThreshold', 85);
    expect(await repo.get('autoPassThreshold')).toBe(85);
    expect(await repo.get('reviewThreshold')).toBe(70); // 不变
    expect((await repo.getAll()).maxJobs).toBe(1000); // 不变
  });

  it('set 多次后 settings 是 merge 不覆盖', async () => {
    await repo.set('autoPassThreshold', 80);
    await repo.set('maxJobs', 500);
    await repo.set('enableInterpretation', true);
    const all = await repo.getAll();
    expect(all.autoPassThreshold).toBe(80);
    expect(all.maxJobs).toBe(500);
    expect(all.enableInterpretation).toBe(true);
    expect(all.reviewThreshold).toBe(70); // 默认保留
  });

  it('reset 恢复默认', async () => {
    await repo.set('autoPassThreshold', 60);
    await repo.set('maxJobs', 100);
    await repo.reset();
    expect(await repo.getAll()).toEqual(DEFAULT_SETTINGS);
  });

  it('持久化：新实例读到已写入值', async () => {
    await repo.set('autoPassThreshold', 88);
    const repo2 = new SettingsRepository(storage);
    expect(await repo2.get('autoPassThreshold')).toBe(88);
  });
});

describe('migrate', () => {
  it('首次迁移：0 → CURRENT_SCHEMA_VERSION', async () => {
    const storage = new MemoryStorage();
    const result = await migrate(storage);
    expect(result.from).toBe(0);
    expect(result.to).toBe(CURRENT_SCHEMA_VERSION);
    expect(await storage.get(StorageKey.SCHEMA_VERSION)).toBe(1);
    expect(await storage.get(StorageKey.JOBS)).toEqual([]);
    expect(await storage.get(StorageKey.SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('migrate 幂等：重复执行无副作用', async () => {
    const storage = new MemoryStorage();
    await migrate(storage);
    // 写入一些数据
    await storage.set<Job[]>(StorageKey.JOBS, [makeJob()]);
    // 再 migrate
    const result = await migrate(storage);
    expect(result.from).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.to).toBe(CURRENT_SCHEMA_VERSION);
    // 数据保留
    const jobs = await storage.get<Job[]>(StorageKey.JOBS);
    expect(jobs).toHaveLength(1);
  });

  it('isInitialized 在迁移前 false 迁移后 true', async () => {
    const storage = new MemoryStorage();
    expect(await isInitialized(storage)).toBe(false);
    await migrate(storage);
    expect(await isInitialized(storage)).toBe(true);
  });
});

describe('exportAll / importAll', () => {
  let storage: MemoryStorage;
  let jobRepo: JobRepository;
  let settingsRepo: SettingsRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    jobRepo = new JobRepository(storage);
    settingsRepo = new SettingsRepository(storage);
  });

  it('exportAll 返回完整 payload', async () => {
    await jobRepo.save(makeJob({ sourceUrl: 'https://x.com/1' }));
    await jobRepo.save(makeJob({ sourceUrl: 'https://x.com/2' }));
    await settingsRepo.set('autoPassThreshold', 85);
    await settingsRepo.set('maxJobs', 2000);

    const payload = await exportAll({ jobs: jobRepo, settings: settingsRepo });
    expect(payload.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(payload.jobs).toHaveLength(2);
    expect(payload.settings.autoPassThreshold).toBe(85);
    expect(payload.settings.maxJobs).toBe(2000);
    expect(typeof payload.exportedAt).toBe('number');
    expect(payload.exportedAt).toBeGreaterThan(0);
  });

  it('exportAll 不修改存储（纯只读）', async () => {
    await jobRepo.save(makeJob({ sourceUrl: 'https://x.com/1' }));
    const before = await jobRepo.getAll();
    await exportAll({ jobs: jobRepo, settings: settingsRepo });
    const after = await jobRepo.getAll();
    expect(after).toEqual(before);
  });

  it('importAll 还原：清空后导入恢复全部数据（Issue #5 验收）', async () => {
    // 准备原始数据
    const origJobs = [
      makeJob({ sourceUrl: 'https://x.com/1', title: '岗位1' }),
      makeJob({ sourceUrl: 'https://x.com/2', title: '岗位2' }),
      makeJob({ sourceUrl: 'https://x.com/3', title: '岗位3' }),
    ];
    await jobRepo.saveAll(origJobs);
    await settingsRepo.set('autoPassThreshold', 80);
    await settingsRepo.set('maxJobs', 800);

    // 导出
    const payload = await exportAll({ jobs: jobRepo, settings: settingsRepo });

    // 清空
    await jobRepo.clear();
    await settingsRepo.reset();
    expect(await jobRepo.count()).toBe(0);
    expect((await settingsRepo.getAll()).autoPassThreshold).toBe(90);

    // 再导入
    const result = await importAll(
      { jobs: jobRepo, settings: settingsRepo },
      payload
    );
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);

    // 验证还原
    expect(await jobRepo.count()).toBe(3);
    const all = await jobRepo.getAll();
    const titles = all.map((j) => j.title).sort();
    expect(titles).toEqual(['岗位1', '岗位2', '岗位3']);
    expect((await settingsRepo.getAll()).autoPassThreshold).toBe(80);
    expect((await settingsRepo.getAll()).maxJobs).toBe(800);
  });

  it('importAll upsert 语义：相同 id 覆盖不重复', async () => {
    await jobRepo.save(makeJob({ sourceUrl: 'https://x.com/1', title: '原始' }));
    const payload = await exportAll({ jobs: jobRepo, settings: settingsRepo });
    payload.jobs = payload.jobs.map((j) => ({ ...j, title: '改了' }));
    const r = await importAll(
      { jobs: jobRepo, settings: settingsRepo },
      payload
    );
    expect(r.imported).toBe(1);
    expect(await jobRepo.count()).toBe(1);
    expect((await jobRepo.getAll())[0].title).toBe('改了');
  });

  it('importAll 跳过无效 Job（缺 title）', async () => {
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      jobs: [
        makeJob({ sourceUrl: 'https://x.com/1' }),
        { ...makeJob({ sourceUrl: 'https://x.com/2' }), title: '' }, // 无效
        { company: 'x', sourceUrl: 'https://x.com/3' } as unknown as Job, // 缺 title
      ],
      settings: DEFAULT_SETTINGS as Settings,
      exportedAt: Date.now(),
    };
    const r = await importAll(
      { jobs: jobRepo, settings: settingsRepo },
      payload
    );
    expect(r.imported).toBe(1);
    expect(r.skipped).toBe(2);
    expect(await jobRepo.count()).toBe(1);
  });

  it('importAll 拒绝高 version', async () => {
    const payload = {
      version: CURRENT_SCHEMA_VERSION + 1,
      jobs: [],
      settings: DEFAULT_SETTINGS as Settings,
      exportedAt: Date.now(),
    };
    await expect(
      importAll({ jobs: jobRepo, settings: settingsRepo }, payload)
    ).rejects.toThrow(/Cannot import v\d+/);
  });

  it('importAll 拒绝非数组 jobs', async () => {
    const payload = {
      version: CURRENT_SCHEMA_VERSION,
      jobs: 'not array' as unknown as Job[],
      settings: DEFAULT_SETTINGS as Settings,
      exportedAt: Date.now(),
    };
    await expect(
      importAll({ jobs: jobRepo, settings: settingsRepo }, payload)
    ).rejects.toThrow(/not an array/);
  });

  it('serializePayload + parsePayload 往返一致', async () => {
    await jobRepo.saveAll([
      makeJob({ sourceUrl: 'https://x.com/1' }),
      makeJob({ sourceUrl: 'https://x.com/2' }),
    ]);
    const payload = await exportAll({ jobs: jobRepo, settings: settingsRepo });
    const json = serializePayload(payload);
    expect(typeof json).toBe('string');
    expect(JSON.parse(json).jobs).toHaveLength(2);

    const parsed = parsePayload(json);
    expect(parsed.version).toBe(payload.version);
    expect(parsed.jobs).toEqual(payload.jobs);
    expect(parsed.settings).toEqual(payload.settings);
  });

  it('parsePayload 拒绝无效 JSON 结构', () => {
    expect(() => parsePayload('{')).toThrow(); // 非法 JSON
    expect(() => parsePayload('null')).toThrow(/not an object/);
    expect(() => parsePayload('{}')).toThrow(/missing version/);
    expect(() => parsePayload('{"version":1}')).toThrow(/jobs is not an array/);
  });
});
