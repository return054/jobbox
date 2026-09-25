// Storage 层统一出口
// 使用方式：
//   import { defaultStorage, jobRepository, settingsRepository } from '@/storage';
//   await migrate(defaultStorage);
//   await jobRepository.save(job);

export type {
  KVStorage,
  ChromeLocalStorage,
  MemoryStorage,
} from './storage-adapter';
export {
  ChromeLocalStorage as ChromeLocalStorageClass,
  MemoryStorage as MemoryStorageClass,
  STORAGE_PREFIX,
  StorageKey,
  createDefaultStorage,
} from './storage-adapter';

export {
  JobRepository,
  hashIdOf,
  DEFAULT_LIMIT,
} from './job-repository';
export type { JobSearchQuery } from './job-repository';

export {
  SettingsRepository,
  DEFAULT_SETTINGS,
} from './settings-repository';
export type { Settings, SettingKey } from './settings-repository';

export {
  CURRENT_SCHEMA_VERSION,
  migrate,
  isInitialized,
} from './migration';

export {
  exportAll,
  importAll,
  serializePayload,
  parsePayload,
} from './import-export';
export type { ExportPayload, ImportResult, ImportExportDeps } from './import-export';

import { createDefaultStorage } from './storage-adapter';
import { JobRepository } from './job-repository';
import { SettingsRepository } from './settings-repository';

/** 默认单例：基于当前运行时自动选择 ChromeLocalStorage 或 MemoryStorage */
export const defaultStorage = createDefaultStorage();
export const jobRepository = new JobRepository(defaultStorage);
export const settingsRepository = new SettingsRepository(defaultStorage);
