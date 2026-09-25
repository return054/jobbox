// 导入/导出 JSON：数据备份与跨设备迁移
// 设计要点：
//   1. exportAll() 输出符合 Issue #5 验收的结构：{ version, jobs, settings, exportedAt }
//   2. importAll() upsert 语义：相同 id 覆盖，否则新增，不删现有数据
//   3. version 不匹配时按 migrate 逻辑处理（当前 v1 直接接收）
//   4. 导入时为缺 id 的 Job 兜底生成（避免去重失效）
//
// 验收要求（Issue #5）：
//   导出 JSON 可再导入还原 → exportAll 后清空再 importAll 应能恢复全部数据

import type { Job } from '../types/job';
import type { Settings } from './settings-repository';
import type { JobRepository } from './job-repository';
import type { SettingsRepository } from './settings-repository';
import { CURRENT_SCHEMA_VERSION } from './migration';
import { hashIdOf } from './job-repository';

/** 导出文件结构 */
export interface ExportPayload {
  /** schema 版本号，与 migrate 的 SCHEMA_VERSION 对齐 */
  version: number;
  /** 全部岗位 */
  jobs: Job[];
  /** 当前设置 */
  settings: Settings;
  /** 导出时间戳（ms） */
  exportedAt: number;
}

/** 导入结果统计 */
export interface ImportResult {
  /** 实际写入（upsert）的条数 */
  imported: number;
  /** 因校验失败而跳过的条数 */
  skipped: number;
}

/** 依赖：import-export 只依赖两个仓储接口，便于测试 mock */
export interface ImportExportDeps {
  jobs: Pick<JobRepository, 'getAll' | 'saveAll' | 'count'>;
  settings: Pick<SettingsRepository, 'getAll' | 'set'>;
}

/**
 * 导出全部数据
 * 不修改存储，纯只读
 */
export async function exportAll(
  deps: ImportExportDeps
): Promise<ExportPayload> {
  const [jobs, settings] = await Promise.all([
    deps.jobs.getAll(),
    deps.settings.getAll(),
  ]);
  return {
    version: CURRENT_SCHEMA_VERSION,
    jobs,
    settings,
    exportedAt: Date.now(),
  };
}

/**
 * 导入数据（upsert 语义）
 * - 对缺 id 的 Job 用 sourceUrl hash 兜底
 * - 缺核心字段（title/company/sourceUrl）的脏数据跳过
 * - version 高于当前：抛错（不支持的向后兼容）
 * - version 低于或等于当前：直接接收
 */
export async function importAll(
  deps: ImportExportDeps,
  payload: ExportPayload
): Promise<ImportResult> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: not an object');
  }
  if (payload.version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Cannot import v${payload.version} payload (current v${CURRENT_SCHEMA_VERSION})`
    );
  }
  if (!Array.isArray(payload.jobs)) {
    throw new Error('Invalid payload: jobs is not an array');
  }

  const validJobs: Job[] = [];
  let skipped = 0;
  for (const j of payload.jobs) {
    if (!isValidJob(j)) {
      skipped++;
      continue;
    }
    validJobs.push({ ...j, id: hashIdOf(j) });
  }

  // upsert 全部合格 Job
  if (validJobs.length > 0) {
    await deps.jobs.saveAll(validJobs);
  }

  // settings 全量覆盖（不合并，用户期望"还原"语义）
  if (payload.settings && typeof payload.settings === 'object') {
    const s = payload.settings;
    const keys = Object.keys(s) as (keyof Settings)[];
    for (const k of keys) {
      await deps.settings.set(k, s[k]);
    }
  }

  return { imported: validJobs.length, skipped };
}

/** Job 数据最低校验：必须有 title / company / sourceUrl */
function isValidJob(j: unknown): j is Job {
  if (!j || typeof j !== 'object') return false;
  const obj = j as Record<string, unknown>;
  return (
    typeof obj.title === 'string' &&
    obj.title.trim().length > 0 &&
    typeof obj.company === 'string' &&
    obj.company.trim().length > 0 &&
    typeof obj.sourceUrl === 'string' &&
    obj.sourceUrl.trim().length > 0
  );
}

/** 序列化为 JSON 字符串（带缩进，便于人读） */
export function serializePayload(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** 从 JSON 字符串反序列化（带最低校验） */
export function parsePayload(json: string): ExportPayload {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON: not an object');
  }
  if (typeof data.version !== 'number') {
    throw new Error('Invalid JSON: missing version field');
  }
  if (!Array.isArray(data.jobs)) {
    throw new Error('Invalid JSON: jobs is not an array');
  }
  return data as ExportPayload;
}
