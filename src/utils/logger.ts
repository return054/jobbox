// JobBox 日志系统（Stage 6）
// 设计：
//   - 两级：INFO / WARN（ERROR 用 JobBoxError 直接 throw，不单独建级）
//   - 带时间戳 + 模块前缀，便于在 service worker / popup / dashboard 控制台定位
//   - 生产环境（NODE_ENV === 'production'）默认关闭 INFO，WARN 保留
//   - 可通过 chrome.storage.local 的 settings 中 logLevel 字段动态调整（未来扩展）
//
// 用法：
//   const log = createLogger('extractor');
//   log.info('提取完成', { strategy, confidence });
//   log.warn('部分字段缺失', { missingFields });

export type LogLevel = 'INFO' | 'WARN' | 'OFF';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

let globalLevel: LogLevel =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? 'WARN' : 'INFO';

/** 设置全局日志级别（OFF 关闭所有） */
export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

/** 获取当前全局日志级别 */
export function getLogLevel(): LogLevel {
  return globalLevel;
}

// 级别数值越大越"严重"；globalLevel 表示最低输出级别
// OFF 数值最大 → 任何 level 都达不到 → 全部关闭
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  INFO: 1,
  WARN: 2,
  OFF: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[globalLevel];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(
    d.getMilliseconds()
  ).padStart(3, '0')}`;
}

/** 创建带模块前缀的 logger */
export function createLogger(module: string) {
  const log = (level: LogLevel, message: string, data?: unknown) => {
    if (!shouldLog(level)) return;
    const entry: LogEntry = { level, module, message, data, timestamp: Date.now() };
    const prefix = `[JobBox/${module}] ${formatTime(entry.timestamp)} [${level}]`;
    if (data === undefined) {
      console.log(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`, data);
    }
  };

  return {
    info: (message: string, data?: unknown) => log('INFO', message, data),
    warn: (message: string, data?: unknown) => log('WARN', message, data),
  };
}
