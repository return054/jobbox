// 设置仓储：用户偏好与全局阈值
// 设计要点：
//   1. 所有配置项都在 DEFAULT_SETTINGS 里声明默认值，缺字段时自动回填
//   2. set(key, value) 单字段写入，与 getAll/load 二合一：读出当前 → 覆盖单字段 → 写回
//   3. 与 Issue #3 验证阈值的 90/70 保持一致；maxJobs 防止 storage 膨胀

import type { KVStorage } from './storage-adapter';
import { StorageKey } from './storage-adapter';

/** 设置结构：用显式接口而非 `typeof DEFAULT`，避免字段被推断为字面量类型 */
export interface Settings {
  /** 自动通过分数阈值（>= 此值直接入库） */
  autoPassThreshold: number;
  /** 人工复核阈值（>= 此值进入待审） */
  reviewThreshold: number;
  /** 历史岗位保留数量上限，超出按 fetchedAt 倒序淘汰最旧的 */
  maxJobs: number;
  /** 是否启用潜台词解析（Stage 4 占位，Issue #9 才真正生效） */
  enableInterpretation: boolean;
}

export type SettingKey = keyof Settings;

/** 全局默认设置 */
export const DEFAULT_SETTINGS: Settings = {
  autoPassThreshold: 90,
  reviewThreshold: 70,
  maxJobs: 1000,
  enableInterpretation: false,
};

export class SettingsRepository {
  constructor(private storage: KVStorage) {}

  /** 读取全部设置（缺字段回填默认） */
  async getAll(): Promise<Settings> {
    const stored =
      (await this.storage.get<Partial<Settings>>(StorageKey.SETTINGS)) ?? {};
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  /** 读取单字段 */
  async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
    const all = await this.getAll();
    return all[key];
  }

  /** 写入单字段（merge，不覆盖其他字段） */
  async set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
    const current = await this.getAll();
    current[key] = value;
    await this.storage.set(StorageKey.SETTINGS, current);
  }

  /** 重置为默认 */
  async reset(): Promise<void> {
    await this.storage.set(StorageKey.SETTINGS, { ...DEFAULT_SETTINGS });
  }
}
