// 搜索栏：关键词 + 状态快速筛选
// 关键词匹配 title/company/description/tags/notes（由 repository 实现）
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type JobStatus,
} from '../../types/job';

const ALL_STATUSES: (JobStatus | 'all')[] = [
  'all',
  'saved',
  'applied',
  'interview',
  'rejected',
  'offer',
];

interface Props {
  keyword: string;
  status: JobStatus | 'all';
  total: number;
  filtered: number;
  onKeywordChange: (kw: string) => void;
  onStatusChange: (s: JobStatus | 'all') => void;
}

export default function SearchBar({
  keyword,
  status,
  total,
  filtered,
  onKeywordChange,
  onStatusChange,
}: Props) {
  return (
    <div className="search-bar">
      <div className="search-bar__input-wrap">
        <input
          className="search-bar__input"
          type="text"
          placeholder="搜索岗位、公司、技能、标签、备注…"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
        />
        <span className="search-bar__count">
          {filtered} / {total}
        </span>
      </div>
      <div className="search-bar__statuses">
        {ALL_STATUSES.map((s) => {
          const active = status === s;
          const label = s === 'all' ? '全部' : JOB_STATUS_LABELS[s];
          const color = s === 'all' ? undefined : JOB_STATUS_COLORS[s];
          return (
            <button
              key={s}
              className={`status-chip ${active ? 'status-chip--active' : ''}`}
              style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
              onClick={() => onStatusChange(s)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
