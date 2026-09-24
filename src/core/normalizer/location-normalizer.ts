// 地点归一化
// 验收 case：
//   "杭州余杭区"      → { province:'浙江', city:'杭州', district:'余杭区' }
//   "北京·朝阳区·望京" → { province:'北京', city:'北京', district:'朝阳区' }
//   "广州天河区"      → { province:'广东', city:'广州', district:'天河区' }
//   "上海"            → { province:'上海', city:'上海', district:'' }

import type { NormalizedLocation } from './types';
import {
  CITY_TO_PROVINCE,
  endsWithDistrictSuffix,
} from '../../data/region-dict';

const EMPTY: NormalizedLocation = {
  raw: '', province: '', city: '', district: '', parsed: false,
};

// 城市名按长度降序，先匹配长 city（如「乌鲁木齐」不会被「乌鲁」截断）
const SORTED_CITIES = Object.keys(CITY_TO_PROVINCE).sort(
  (a, b) => b.length - a.length
);

// 分隔符：· • - / 空格 顿号 逗号
const SEPARATORS = /[·•\-\s/、，,]+/;

function findCity(s: string): string | null {
  for (const city of SORTED_CITIES) {
    if (s.includes(city)) return city;
  }
  return null;
}

export function normalizeLocation(input: string): NormalizedLocation {
  const raw = (input ?? '').trim();
  if (!raw) return { ...EMPTY, raw };

  const city = findCity(raw);
  if (!city) {
    // 未匹配到任何已知 city：把整段塞进 city 字段，province/district 留空
    return { raw, province: '', city: raw, district: '', parsed: false };
  }

  const province = CITY_TO_PROVINCE[city] ?? '';
  const afterCity = raw.slice(raw.indexOf(city) + city.length);
  const parts = afterCity.split(SEPARATORS).map((p) => p.trim()).filter(Boolean);

  // 取第一个以 district 后缀结尾的片段
  let district = '';
  for (const part of parts) {
    if (endsWithDistrictSuffix(part)) {
      district = part;
      break;
    }
  }

  return { raw, province, city, district, parsed: true };
}
