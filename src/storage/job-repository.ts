// 岗位仓储：CRUD + 内存搜索 + 标签/状态/备注操作
// 设计要点：
//   1. 单 key 持久化整个 Job[]（chrome.storage.local 容量 10MB，1000 条岗位 ~1MB，足够）
//   2. 所有查询在内存里做（一次 getAll 全量加载，filter/sort 都在 JS 数组上）
//   3. save/saveAll 用 upsert 语义：相同 id 覆盖，否则追加
//   4. Job.id 缺失时，Repository 用 sourceUrl 的 djb2 hash 兜底生成
//   5. Stage 5: 支持 status/tags/autoTags/notes 的原子更新；搜索扩展到 8 个维度
//
// 性能验收（Issue #5 / #6）：
//   - 1000 条数据搜索无明显卡顿：search 全内存过滤，单次 < 5ms
//   - 单次 update = getAll + 修改 + setAll，1000 条下 ~3-5ms

import type { Job, JobStatus } from '../types/job';
import type { KVStorage } from './storage-adapter';
import { StorageKey } from './storage-adapter';
import { interpret } from '../core/interpreter/interpreter';

/** 搜索条件（Stage 5 扩展） */
export interface JobSearchQuery {
  /** 关键词：在 title + company + description + tags + autoTags + notes 中匹配 */
  keyword?: string;
  /** 城市：匹配 normalized.location.city，或 location 字符串包含 */
  city?: string;
  /** 最低月薪（元），用 normalized.salary.min 比较 */
  salaryMin?: number;
  /** 最高月薪（元），用 normalized.salary.max 比较 */
  salaryMax?: number;
  /** 学历：匹配 normalized.education.level */
  education?: string;
  /** 最低经验年限：匹配 normalized.experience.min */
  experienceMin?: number;
  /** 最高经验年限：匹配 normalized.experience.max（0 表示不限） */
  experienceMax?: number;
  /** 申请状态：精确匹配 Job.status */
  status?: JobStatus;
  /** 标签：匹配用户 tags（OR 语义，命中任一即可） */
  tags?: string[];
  /** 来源平台：精确匹配 Job.source */
  source?: string;
  /** 返回条数上限，默认 50 */
  limit?: number;
  /** 偏移量，默认 0 */
  offset?: number;
}

/** 搜索结果排序：默认按 fetchedAt 倒序（最新在前） */
export const DEFAULT_LIMIT = 50;

/** djb2 hash：与 deduplicator 一致，避免引入循环依赖另起一份 */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** 由 sourceUrl 兜底生成 id（调用方未提供时使用） */
export function hashIdOf(job: Partial<Job>): string {
  if (job.id) return job.id;
  return `u_${djb2(job.sourceUrl ?? '')}`;
}

/**
 * Issue #11: 确保岗位有潜台词解读结果
 * 如果已有 interpretation 则原样返回；否则根据 description 生成
 * 不修改原 Job，返回新对象
 */
function ensureInterpretation(job: Job): Job {
  if (job.interpretation) return job;
  if (!job.description?.trim()) return job;
  return { ...job, interpretation: interpret(job) };
}

export class JobRepository {
  constructor(private storage: KVStorage) {}

  /** 读取全部岗位 */
  async getAll(): Promise<Job[]> {
    const jobs = await this.storage.get<Job[]>(StorageKey.JOBS);
    return jobs ?? [];
  }

  /** 按 id 读取单个岗位 */
  async getById(id: string): Promise<Job | null> {
    const jobs = await this.getAll();
    return jobs.find((j) => j.id === id) ?? null;
  }

  /** upsert 单条岗位 */
  async save(job: Job): Promise<void> {
    const id = hashIdOf(job);
    const jobs = await this.getAll();
    const idx = jobs.findIndex((j) => j.id === id);
    // Issue #11: 保存前自动生成潜台词解读（如缺失且有 description）
    const withInterp = ensureInterpretation(job);
    const next: Job = { ...withInterp, id, updatedAt: withInterp.updatedAt ?? Date.now() };
    if (idx >= 0) {
      jobs[idx] = next;
    } else {
      jobs.push(next);
    }
    await this.storage.set(StorageKey.JOBS, jobs);
  }

  /** 批量 upsert（一次读 + 一次写，避免 N 次 IO） */
  async saveAll(jobs: Job[]): Promise<void> {
    if (jobs.length === 0) return;
    const existing = await this.getAll();
    const byId = new Map<string, Job>();
    for (const j of existing) {
      if (j.id) byId.set(j.id, j);
    }
    for (const j of jobs) {
      const id = hashIdOf(j);
      const withInterp = ensureInterpretation(j);
      byId.set(id, { ...withInterp, id, updatedAt: withInterp.updatedAt ?? Date.now() });
    }
    await this.storage.set(StorageKey.JOBS, Array.from(byId.values()));
  }

  /** 删除单条 */
  async delete(id: string): Promise<void> {
    const jobs = await this.getAll();
    const next = jobs.filter((j) => j.id !== id);
    if (next.length === jobs.length) return;
    await this.storage.set(StorageKey.JOBS, next);
  }

  /** 清空全部岗位 */
  async clear(): Promise<void> {
    await this.storage.set<Job[]>(StorageKey.JOBS, []);
  }

  /** 统计数量 */
  async count(): Promise<number> {
    const jobs = await this.getAll();
    return jobs.length;
  }

  /**
   * 通用局部更新：内部使用，外部调用专用方法（updateStatus 等）
   * updater 返回新 Job，若返回原引用则不写入（无变化优化）
   */
  private async update(id: string, updater: (job: Job) => Job): Promise<Job | null> {
    const jobs = await this.getAll();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx < 0) return null;
    const original = jobs[idx];
    const updated = updater(original);
    if (updated === original) return original; // 无变化
    jobs[idx] = { ...updated, updatedAt: Date.now() };
    await this.storage.set(StorageKey.JOBS, jobs);
    return jobs[idx];
  }

  /** 更新申请状态 */
  async updateStatus(id: string, status: JobStatus): Promise<Job | null> {
    return this.update(id, (j) => (j.status === status ? j : { ...j, status }));
  }

  /** 添加用户标签（去重，忽略空白） */
  async addTag(id: string, tag: string): Promise<Job | null> {
    const trimmed = tag.trim();
    if (!trimmed) return null;
    return this.update(id, (j) => {
      const tags = new Set(j.tags ?? []);
      if (tags.has(trimmed)) return j;
      tags.add(trimmed);
      return { ...j, tags: Array.from(tags) };
    });
  }

  /** 移除用户标签 */
  async removeTag(id: string, tag: string): Promise<Job | null> {
    return this.update(id, (j) => {
      if (!j.tags?.includes(tag)) return j;
      return { ...j, tags: j.tags.filter((t) => t !== tag) };
    });
  }

  /** 全量替换用户标签 */
  async setTags(id: string, tags: string[]): Promise<Job | null> {
    const cleaned = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
    return this.update(id, (j) => {
      const current = j.tags ?? [];
      if (arraysEqual(current, cleaned)) return j;
      return { ...j, tags: cleaned };
    });
  }

  /** 设置自动标签（系统生成，用户不可编辑，与用户 tags 分离） */
  async setAutoTags(id: string, autoTags: string[]): Promise<Job | null> {
    return this.update(id, (j) => {
      if (arraysEqual(j.autoTags ?? [], autoTags)) return j;
      return { ...j, autoTags };
    });
  }

  /** 更新备注 */
  async updateNotes(id: string, notes: string): Promise<Job | null> {
    return this.update(id, (j) => (j.notes === notes ? j : { ...j, notes }));
  }

  /**
   * 在内存里搜索岗位
   * 性能：1000 条全字段过滤 < 5ms（与 chrome.storage 无关）
   */
  async search(query: JobSearchQuery): Promise<Job[]> {
    const jobs = await this.getAll();
    const filtered = jobs.filter((j) => this.matches(j, query));
    // 两级排序：先 updatedAt 倒序（有修改排前），相同则 fetchedAt 倒序
    filtered.sort((a, b) => {
      const au = a.updatedAt ?? 0;
      const bu = b.updatedAt ?? 0;
      if (bu !== au) return bu - au;
      return b.fetchedAt - a.fetchedAt;
    });
    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.max(1, query.limit ?? DEFAULT_LIMIT);
    return filtered.slice(offset, offset + limit);
  }

  /** 单条岗位是否匹配搜索条件 */
  private matches(job: Job, q: JobSearchQuery): boolean {
    if (q.keyword) {
      const kw = q.keyword.trim().toLowerCase();
      if (kw) {
        const tagStr = [...(job.tags ?? []), ...(job.autoTags ?? [])].join(' ');
        const hay = `${job.title} ${job.company} ${job.description} ${tagStr} ${job.notes ?? ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
    }
    if (q.city) {
      const c = q.city.trim();
      if (c) {
        const normCity = job.normalized?.location?.city;
        const ok = normCity ? normCity === c : job.location.includes(c);
        if (!ok) return false;
      }
    }
    if (q.salaryMin !== undefined || q.salaryMax !== undefined) {
      const sal = job.normalized?.salary;
      if (sal?.parsed) {
        if (q.salaryMin !== undefined && sal.min < q.salaryMin) return false;
        if (q.salaryMax !== undefined && sal.max > q.salaryMax) return false;
      }
    }
    if (q.education) {
      const edu = job.normalized?.education?.level;
      if (edu && edu !== q.education) return false;
    }
    if (q.experienceMin !== undefined || q.experienceMax !== undefined) {
      const exp = job.normalized?.experience;
      if (exp?.parsed) {
        if (q.experienceMin !== undefined && exp.min < q.experienceMin) return false;
        // exp.max === 0 表示不限上限，不应被 experienceMax 过滤
        if (q.experienceMax !== undefined && exp.max > 0 && exp.max > q.experienceMax) return false;
      }
    }
    if (q.status) {
      if ((job.status ?? 'saved') !== q.status) return false;
    }
    if (q.tags && q.tags.length > 0) {
      const jobTags = job.tags ?? [];
      // OR 语义：命中任一选中标签即匹配
      const hit = q.tags.some((t) => jobTags.includes(t));
      if (!hit) return false;
    }
    if (q.source) {
      if (job.source !== q.source) return false;
    }
    return true;
  }
}

/** 数组内容相等判断（无序无关，用于 tags 比较） */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((x) => setA.has(x));
}
