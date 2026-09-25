// 列表项：岗位卡片，展示核心信息 + 状态 + 标签 + 操作入口
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type Job,
  type JobStatus,
} from '../../types/job';

interface Props {
  job: Job;
  onClick: () => void;
}

export default function JobListItem({ job, onClick }: Props) {
  const status: JobStatus = job.status ?? 'saved';
  const userTags = job.tags ?? [];
  const autoTags = job.autoTags ?? [];

  return (
    <article className="job-card" onClick={onClick}>
      <header className="job-card__header">
        <h3 className="job-card__title" title={job.title}>{job.title}</h3>
        <span
          className="job-card__status"
          style={{ backgroundColor: JOB_STATUS_COLORS[status] }}
        >
          {JOB_STATUS_LABELS[status]}
        </span>
      </header>
      <div className="job-card__meta">
        <span className="job-card__company">{job.company}</span>
        <span className="job-card__salary">{job.salary || '薪资面议'}</span>
        <span className="job-card__location">{job.location || '地点未知'}</span>
      </div>
      {(userTags.length > 0 || autoTags.length > 0) && (
        <div className="job-card__tags">
          {autoTags.map((t) => (
            <span key={`a-${t}`} className="tag tag--auto" title="系统自动标签">{t}</span>
          ))}
          {userTags.map((t) => (
            <span key={`u-${t}`} className="tag tag--user">{t}</span>
          ))}
        </div>
      )}
      <footer className="job-card__footer">
        <span className="job-card__source">{job.source}</span>
        <span className="job-card__time">
          {formatTime(job.updatedAt ?? job.fetchedAt)}
        </span>
      </footer>
    </article>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}
