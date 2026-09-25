// 错误状态码与日志系统单元测试（Stage 6）

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  JobBoxError,
  JobBoxErrorCode,
  ERROR_MESSAGES,
} from '../types/errors';
import { createLogger, setLogLevel, getLogLevel } from '../utils/logger';

describe('JobBoxError', () => {
  it('每种错误码都有对应提示文案', () => {
    for (const code of Object.values(JobBoxErrorCode)) {
      expect(ERROR_MESSAGES[code]).toBeTruthy();
    }
  });

  it('默认使用 ERROR_MESSAGES 中的文案', () => {
    const e = new JobBoxError(JobBoxErrorCode.PAGE_NOT_SUPPORTED);
    expect(e.message).toBe(ERROR_MESSAGES[JobBoxErrorCode.PAGE_NOT_SUPPORTED]);
    expect(e.code).toBe(JobBoxErrorCode.PAGE_NOT_SUPPORTED);
  });

  it('可自定义 message', () => {
    const e = new JobBoxError(JobBoxErrorCode.JOB_NOT_FOUND, '自定义消息');
    expect(e.message).toBe('自定义消息');
  });

  it('from() 对普通 Error 兜底为 UNKNOWN', () => {
    const e = JobBoxError.from(new Error('boom'));
    expect(e.code).toBe(JobBoxErrorCode.UNKNOWN);
    expect(e.message).toBe('boom');
  });

  it('from() 对 JobBoxError 原样返回', () => {
    const original = new JobBoxError(JobBoxErrorCode.STORAGE_ERROR);
    const e = JobBoxError.from(original);
    expect(e).toBe(original);
  });

  it('from() 对非 Error 值转字符串', () => {
    const e = JobBoxError.from('字符串错误');
    expect(e.code).toBe(JobBoxErrorCode.UNKNOWN);
    expect(e.message).toBe('字符串错误');
  });
});

describe('logger', () => {
  const originalLevel = getLogLevel();
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setLogLevel('INFO');
  });

  afterEach(() => {
    logSpy.mockRestore();
    setLogLevel(originalLevel);
  });

  it('INFO 级别输出 info 消息', () => {
    const log = createLogger('test');
    log.info('hello');
    expect(logSpy).toHaveBeenCalled();
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('[JobBox/test]');
    expect(call).toContain('[INFO]');
    expect(call).toContain('hello');
  });

  it('WARN 级别输出 warn 消息', () => {
    const log = createLogger('test');
    log.warn('危险');
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('[WARN]');
  });

  it('设为 OFF 后不输出任何日志', () => {
    setLogLevel('OFF');
    const log = createLogger('test');
    log.info('a');
    log.warn('b');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('设为 WARN 后 INFO 被过滤，WARN 保留', () => {
    setLogLevel('WARN');
    const log = createLogger('test');
    log.info('info-msg');
    log.warn('warn-msg');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toContain('warn-msg');
  });

  it('输出包含时间戳格式 HH:MM:SS.mmm', () => {
    const log = createLogger('test');
    log.info('ts');
    const call = logSpy.mock.calls[0][0] as string;
    expect(call).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
  });
});
