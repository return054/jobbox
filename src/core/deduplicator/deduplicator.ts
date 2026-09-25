// 去重器：基于 canonicalUrl + fingerprint 两层判定
// 验收要求：/job/123 与 /job/123?source=xxx 判定为同一岗位
//
// fingerprint 字段选取（同一岗位强信号）：
//   title + company + city + salary(min/max/unit)
// 不含 district：同一公司同一岗位在不同办公点也会发布多次，
// 这种我们想当作"同一岗位"合并，所以 district 不参与指纹。

import { canonicalizeUrl } from '../../utils/url';
import type { Job } from '../../types/job';
import type { NormalizedJob } from '../normalizer/types';

export interface DedupRecord {
  url: string;
  job: Partial<Job>;
  normalized?: Partial<NormalizedJob>;
}

export interface DedupResult {
  isDuplicate: boolean;
  reason: 'canonical_url' | 'fingerprint' | 'none';
}

/** djb2 hash：稳定 32-bit，输出 36 进制字符串 */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** 计算 URL 的标准形式 */
export function canonicalUrlOf(url: string): string {
  return canonicalizeUrl(url);
}

/** 计算岗位指纹 */
export function fingerprintOf(
  job: Partial<Job>,
  normalized?: Partial<NormalizedJob>
): string {
  const parts: string[] = [];
  parts.push((job.title ?? '').trim().toLowerCase());
  parts.push((job.company ?? '').trim().toLowerCase());
  const loc = normalized?.location;
  if (loc?.parsed) parts.push(loc.city);
  const sal = normalized?.salary;
  if (sal?.parsed) parts.push(`${sal.min}-${sal.max}-${sal.unit}`);
  return djb2(parts.join('|'));
}

/** 判定两条记录是否同一岗位 */
export function isDuplicate(a: DedupRecord, b: DedupRecord): DedupResult {
  if (canonicalUrlOf(a.url) === canonicalUrlOf(b.url)) {
    return { isDuplicate: true, reason: 'canonical_url' };
  }
  if (fingerprintOf(a.job, a.normalized) === fingerprintOf(b.job, b.normalized)) {
    return { isDuplicate: true, reason: 'fingerprint' };
  }
  return { isDuplicate: false, reason: 'none' };
}
