// URL 标准化：去除 tracking 参数，用于岗位去重时的 URL 比对
// 验收要求：/job/123 与 /job/123?source=xxx 判定为同一岗位
//
// 设计：
// - 只保留对资源定位有意义的 path + 必要 query
// - 移除 utm_*、source、from、ref 系列、spm 等追踪参数
// - 剩余 query 按字母序排序，保证不同顺序输入产生同一 canonicalUrl
// - 不去 hash：部分招聘平台把岗位 id 放在 hash 后面（如 SPA），去 hash 会破坏去重

/** 已知的 tracking 参数前缀 / 全名集合 */
const TRACKING_PARAM_PREFIXES = ['utm_', 'hm_', '_h', 'spm_'];
const TRACKING_PARAM_NAMES = new Set<string>([
  'source', 'from', 'from_source', 'ref', 'ref_src', 'ref_url',
  'spm', 'share', 'share_source', 'share_id', 'scene',
  '_ts', 'ts', 'traceid', 'trace_id', 'request_id', 'requestid',
  'channel', 'medium', 'campaign', 'click_id', 'clickid',
  'p_id', 'u_id', 'platform', 'device', 'regaved',
  'mtag', 'share_token', 'fbclid', 'gclid',
]);

function isTrackingParam(name: string): boolean {
  if (TRACKING_PARAM_NAMES.has(name)) return true;
  for (const prefix of TRACKING_PARAM_PREFIXES) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * 标准化 URL：去 tracking 参数，剩余参数按字母序排序。
 * 解析失败时返回原 URL（去空白）作为兜底。
 */
export function canonicalizeUrl(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const kept: [string, string][] = [];
    u.searchParams.forEach((value, key) => {
      if (!isTrackingParam(key)) kept.push([key, value]);
    });
    kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const query = kept
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const path = u.pathname.replace(/\/+/g, '/');
    const canonical = `${u.protocol}//${u.host}${path}${query ? `?${query}` : ''}${u.hash}`;
    return canonical;
  } catch {
    return raw;
  }
}
