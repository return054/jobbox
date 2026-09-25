// 数据迁移：管理 schema 版本与升级路径
// 设计要点：
//   1. 启动时（onInstalled / SW 唤醒）调一次 migrate()，幂等执行
//   2. 当前版本 v1：首次安装时初始化空 jobs 数组 + 默认 settings + version=1
//   3. 未来新增字段或改结构时，新增 N→N+1 迁移函数并递增 CURRENT_SCHEMA_VERSION
//   4. 迁移失败必须抛错，由上层捕获并日志（不能静默吞掉数据损坏）

import type { KVStorage } from './storage-adapter';
import { StorageKey } from './storage-adapter';
import { DEFAULT_SETTINGS } from './settings-repository';

/** 当前 schema 版本：每次结构升级 +1 */
export const CURRENT_SCHEMA_VERSION = 1;

/** 各版本的迁移函数：from=当前版本，to=目标版本 */
type MigrationFn = (storage: KVStorage) => Promise<void>;

const migrations: Record<number, MigrationFn> = {
  // 0 → 1：首次初始化
  0: async (storage) => {
    await storage.set<unknown[]>(StorageKey.JOBS, []);
    await storage.set(StorageKey.SETTINGS, { ...DEFAULT_SETTINGS });
  },
  // 未来：
  // 1: async (storage) => { /* v1→v2：把 description 字段从 markdown 转 text */ },
  // 2: async (storage) => { /* v2→v3 */ },
};

/**
 * 执行所有待执行的迁移
 * 返回 { from, to }，from === to 表示已是最新无需迁移
 */
export async function migrate(
  storage: KVStorage
): Promise<{ from: number; to: number }> {
  let currentVersion =
    (await storage.get<number>(StorageKey.SCHEMA_VERSION)) ?? 0;

  const from = currentVersion;
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const next = currentVersion + 1;
    const migrateFn = migrations[currentVersion];
    if (!migrateFn) {
      throw new Error(
        `JobBox migration: no migration path from v${currentVersion} to v${next}`
      );
    }
    await migrateFn(storage);
    await storage.set(StorageKey.SCHEMA_VERSION, next);
    currentVersion = next;
  }

  return { from, to: currentVersion };
}

/** 是否已初始化（用于按需触发迁移而不强制每次启动都执行） */
export async function isInitialized(
  storage: KVStorage
): Promise<boolean> {
  const version = await storage.get<number>(StorageKey.SCHEMA_VERSION);
  return version !== null && version >= CURRENT_SCHEMA_VERSION;
}
