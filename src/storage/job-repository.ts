// 岗位仓储：CRUD + 内存搜索
// 设计要点：
//   1. 单 key 持久化整个 Job[]（chrome.storage.local 容量 10MB，1000 条岗位 ~1MB，足够）
//   2. 所有查询在内存里做（一次 getAll 全量加载，filter/sort 都在 JS 数组上）
//   3. save/saveAll 用 upsert 语义：相同 id 覆盖，否则追加
//   4. Job.id 缺失时，Repository 用 sourceUrl 的 djb2 hash 兜底生成
//
// 性能验收（Issue #5）：
//   - 1000 条数据搜索无明显卡顿：search 全内存过滤，单次 < 5ms
//   - 单次 save = getAll + 修改 + setAll，1000 条下 ~3-5ms

import type { Job } from '../types/job';
import type { KVStorage } from './storage-adapter';
import { StorageKey } from './storage-adapter';

/** 搜索条件 */
export interface JobSearchQuery {
  /** 关键词（在 title + company + description 中匹配，大小写不敏感） */
  keyword?: string;
  /** 城市：匹配 normalized.location.city，或 location 字符串包含 */
  city?: string;
  /** 最低月薪（元），用 normalized.salary.min 比较 */
  salaryMin?: number;
  /** 最高月薪（元），用 normalized.salary.max 比较 */
  salaryMax?: number;
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
    const next: Job = { ...job, id };
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
      byId.set(id, { ...j, id });
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
   * 在内存里搜索岗位
   * 性能：1000 条全字段过滤 < 5ms（与 chrome.storage 无关）
   */
  async search(query: JobSearchQuery): Promise<Job[]> {
    const jobs = await this.getAll();
    const filtered = jobs.filter((j) => this.matches(j, query));
    // 默认按 fetchedAt 倒序
    filtered.sort((a, b) => b.fetchedAt - a.fetchedAt);
    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.max(1, query.limit ?? DEFAULT_LIMIT);
    return filtered.slice(offset, offset + limit);
  }

  /** 单条岗位是否匹配搜索条件 */
  private matches(job: Job, q: JobSearchQuery): boolean {
    if (q.keyword) {
      const kw = q.keyword.trim().toLowerCase();
      if (kw) {
        const hay = `${job.title} ${job.company} ${job.description}`.toLowerCase();
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
        // 语义：用户希望月薪至少 salaryMin → 岗位下限 < salaryMin 则排除
        //       用户希望月薪至多 salaryMax → 岗位上限 > salaryMax 则排除
        if (q.salaryMin !== undefined && sal.min < q.salaryMin) return false;
        if (q.salaryMax !== undefined && sal.max > q.salaryMax) return false;
      }
      // normalized 缺失或未解析时不参与薪资过滤（避免误删）
    }
    return true;
  }
}
