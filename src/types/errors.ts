// JobBox 错误状态码与结构化错误类型（Stage 6）
// 所有面向用户/调用方的错误统一用 JobBoxError 承载，便于 UI 展示与日志归档

/** 错误码枚举 */
export enum JobBoxErrorCode {
  /** 页面不支持采集（chrome://、edge://、扩展商店等受限页面） */
  PAGE_NOT_SUPPORTED = 'PAGE_NOT_SUPPORTED',
  /** 页面不是招聘详情页（提取置信度为 0） */
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  /** 部分核心字段缺失（confidence > 0 但 < 100） */
  PARTIAL_EXTRACTION = 'PARTIAL_EXTRACTION',
  /** 数据校验不通过（评分 < 70，REJECT） */
  INVALID_DATA = 'INVALID_DATA',
  /** 岗位已存在（重复） */
  DUPLICATE_JOB = 'DUPLICATE_JOB',
  /** 存储读写异常 */
  STORAGE_ERROR = 'STORAGE_ERROR',
  /** 未知/未分类错误 */
  UNKNOWN = 'UNKNOWN',
}

/** 错误码对应的用户可读提示 */
export const ERROR_MESSAGES: Record<JobBoxErrorCode, string> = {
  [JobBoxErrorCode.PAGE_NOT_SUPPORTED]: '此页面不支持采集',
  [JobBoxErrorCode.JOB_NOT_FOUND]: '未在当前页面识别到招聘岗位',
  [JobBoxErrorCode.PARTIAL_EXTRACTION]: '岗位信息提取不完整，建议手动补充',
  [JobBoxErrorCode.INVALID_DATA]: '岗位数据校验未通过，无法保存',
  [JobBoxErrorCode.DUPLICATE_JOB]: '该岗位已保存过',
  [JobBoxErrorCode.STORAGE_ERROR]: '数据存储异常，请重试',
  [JobBoxErrorCode.UNKNOWN]: '发生未知错误',
};

/** 结构化错误 */
export class JobBoxError extends Error {
  readonly code: JobBoxErrorCode;
  readonly details?: unknown;

  constructor(code: JobBoxErrorCode, message?: string, details?: unknown) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'JobBoxError';
    this.code = code;
    this.details = details;
  }

  /** 从任意 Error 构造 JobBoxError（未知错误兜底） */
  static from(err: unknown, fallbackCode = JobBoxErrorCode.UNKNOWN): JobBoxError {
    if (err instanceof JobBoxError) return err;
    const message = err instanceof Error ? err.message : String(err);
    return new JobBoxError(fallbackCode, message, err);
  }
}
