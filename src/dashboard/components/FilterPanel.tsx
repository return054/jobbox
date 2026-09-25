// 筛选面板：城市 / 薪资范围 / 学历 / 经验 / 来源
// 所有筛选条件汇总到 JobSearchQuery，由 repository 在内存里过滤
import { EDUCATION_LEVELS } from '../../core/normalizer/types';
import type { JobSearchQuery } from '../../storage/job-repository';

interface Props {
  query: JobSearchQuery;
  cities: string[];
  sources: string[];
  onChange: (patch: Partial<JobSearchQuery>) => void;
  onReset: () => void;
}

const SALARY_OPTIONS = [
  { label: '不限', min: undefined, max: undefined },
  { label: '5K 以下', max: 5000 },
  { label: '5-10K', min: 5000, max: 10000 },
  { label: '10-20K', min: 10000, max: 20000 },
  { label: '20-50K', min: 20000, max: 50000 },
  { label: '50K 以上', min: 50000 },
];

const EXPERIENCE_OPTIONS = [
  { label: '不限', min: undefined, max: undefined },
  { label: '应届', min: 0, max: 0 },
  { label: '1-3 年', min: 1, max: 3 },
  { label: '3-5 年', min: 3, max: 5 },
  { label: '5-10 年', min: 5, max: 10 },
  { label: '10 年以上', min: 10 },
];

export default function FilterPanel({
  query,
  cities,
  sources,
  onChange,
  onReset,
}: Props) {
  return (
    <div className="filter-panel">
      <div className="filter-panel__row">
        <label className="filter-panel__label">城市</label>
        <select
          className="filter-panel__select"
          value={query.city ?? ''}
          onChange={(e) => onChange({ city: e.target.value || undefined })}
        >
          <option value="">不限</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="filter-panel__row">
        <label className="filter-panel__label">薪资</label>
        <select
          className="filter-panel__select"
          value={salaryKey(query)}
          onChange={(e) => {
            const opt = SALARY_OPTIONS[Number(e.target.value)];
            onChange({ salaryMin: opt.min, salaryMax: opt.max });
          }}
        >
          {SALARY_OPTIONS.map((o, i) => (
            <option key={i} value={i}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="filter-panel__row">
        <label className="filter-panel__label">学历</label>
        <select
          className="filter-panel__select"
          value={query.education ?? ''}
          onChange={(e) => onChange({ education: e.target.value || undefined })}
        >
          <option value="">不限</option>
          {EDUCATION_LEVELS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      <div className="filter-panel__row">
        <label className="filter-panel__label">经验</label>
        <select
          className="filter-panel__select"
          value={experienceKey(query)}
          onChange={(e) => {
            const opt = EXPERIENCE_OPTIONS[Number(e.target.value)];
            onChange({ experienceMin: opt.min, experienceMax: opt.max });
          }}
        >
          {EXPERIENCE_OPTIONS.map((o, i) => (
            <option key={i} value={i}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="filter-panel__row">
        <label className="filter-panel__label">来源</label>
        <select
          className="filter-panel__select"
          value={query.source ?? ''}
          onChange={(e) => onChange({ source: e.target.value || undefined })}
        >
          <option value="">不限</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <button className="filter-panel__reset" onClick={onReset}>
        重置筛选
      </button>
    </div>
  );
}

/** 根据当前 query 反推薪资下拉选中项索引 */
function salaryKey(q: JobSearchQuery): string {
  const idx = SALARY_OPTIONS.findIndex(
    (o) => o.min === q.salaryMin && o.max === q.salaryMax
  );
  return String(idx >= 0 ? idx : 0);
}

/** 根据当前 query 反推经验下拉选中项索引 */
function experienceKey(q: JobSearchQuery): string {
  const idx = EXPERIENCE_OPTIONS.findIndex(
    (o) => o.min === q.experienceMin && o.max === q.experienceMax
  );
  return String(idx >= 0 ? idx : 0);
}
