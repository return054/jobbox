// chrome.storage.local 的薄抽象层
// 目的：
//   1. 测试环境（jsdom 无 chrome API）用 MemoryStorage 注入，无需 mock 全局 chrome
//   2. 业务代码只依赖 KVStorage 接口，未来切到 indexedDB / session storage 不动调用方
// 设计要点：
//   - 所有 key 一律按业务前缀命名（"jobbox:jobs" / "jobbox:settings:*"），避免与扩展其他模块冲突
//   - 接口只暴露 get/set/remove/clear 四个原子操作，复杂查询由上层 Repository 在内存里做
//
// 注意：chrome.storage.local 的回调是异步的，且对结构化克隆可序列化数据是深拷贝
//       但函数、Date 等会丢失；当前 Job 都是 plain object，无需担心

/** KV 存储抽象：所有持久化模块依赖此接口 */
export interface KVStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** key 前缀：所有 JobBox 写入的 key 都以此开头，便于整体清理与排查 */
export const STORAGE_PREFIX = 'jobbox:';

/** 业务 key 集中管理，避免散落字符串字面量 */
export const StorageKey = {
  /** 全部岗位列表（Job[]） */
  JOBS: `${STORAGE_PREFIX}jobs`,
  /** 设置对象（Record<string, unknown>） */
  SETTINGS: `${STORAGE_PREFIX}settings`,
  /** schema 版本号（number） */
  SCHEMA_VERSION: `${STORAGE_PREFIX}schema_version`,
} as const;

/**
 * chrome.storage.local 适配器
 * 仅在扩展运行时使用；测试环境请用 MemoryStorage
 */
export class ChromeLocalStorage implements KVStorage {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    const v = result[key] as T | undefined;
    return v ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clear(): Promise<void> {
    // 仅清理 JobBox 自己的 key，避免误删其他扩展数据
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(STORAGE_PREFIX));
    if (keys.length > 0) {
      await chrome.storage.local.remove(keys);
    }
  }
}

/**
 * 内存存储 mock：测试环境使用
 * 行为模拟 chrome.storage.local：深拷贝写入值，避免外部修改污染存储
 */
export class MemoryStorage implements KVStorage {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    const raw = this.store.get(key) as T | null;
    return this.clone<T>(raw);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, this.clone(value));
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    const keys = Array.from(this.store.keys()).filter((k) =>
      k.startsWith(STORAGE_PREFIX)
    );
    for (const k of keys) {
      this.store.delete(k);
    }
  }

  /** 深拷贝：模拟 chrome.storage.local 的结构化克隆语义 */
  private clone<T>(value: T | null): T | null {
    if (value === null || value === undefined) return null;
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

/**
 * 默认存储实例选择器：
 * - 有 chrome.storage.local → 用 ChromeLocalStorage
 * - 否则 → 用 MemoryStorage（主要用于 vitest jsdom 环境）
 */
export function createDefaultStorage(): KVStorage {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new ChromeLocalStorage();
  }
  return new MemoryStorage();
}
