// JobBox 岗位库 Dashboard（Stage 5）
// 职责：
//   - 加载全部岗位（内存缓存，搜索/筛选 1000 条不卡顿）
//   - 关键词搜索 + 状态快速筛选 + 多维筛选面板
//   - 点击卡片打开详情，支持改状态/增删标签/改备注/删除
//   - 顶部提供导入/导出入口（复用 Stage 4 的 import-export）
//
// 数据流：jobRepository（singleton）→ state.jobs → 过滤 → 列表渲染
//         详情操作直接调 repository，成功后更新本地 state 并刷新

import { useCallback, useEffect, useMemo, useState } from 'react';
import { jobRepository } from '../storage';
import { exportAll, importAll, serializePayload, parsePayload } from '../storage/import-export';
import { settingsRepository } from '../storage';
import type { Job, JobStatus } from '../types/job';
import type { JobSearchQuery } from '../storage/job-repository';
import SearchBar from './components/SearchBar';
import FilterPanel from './components/FilterPanel';
import JobListItem from './components/JobListItem';
import JobDetail from './components/JobDetail';

type StatusFilter = JobStatus | 'all';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 搜索/筛选状态
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState<JobSearchQuery>({});

  // 加载全部岗位
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const all = await jobRepository.getAll();
      setJobs(all);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 从 jobs 提取城市/来源列表（用于筛选下拉）
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      const c = j.normalized?.location?.city;
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [jobs]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) set.add(j.source);
    return Array.from(set).sort();
  }, [jobs]);

  // 合并关键词 + 状态 + 筛选条件，交给 repository 搜索
  const mergedQuery: JobSearchQuery = useMemo(() => {
    const q: JobSearchQuery = { ...query };
    if (keyword.trim()) q.keyword = keyword;
    if (status !== 'all') q.status = status;
    return q;
  }, [query, keyword, status]);

  // 执行搜索（内存过滤，1000 条 < 5ms）
  const filteredJobs = useMemo(() => {
    const q = mergedQuery;
    return jobs.filter((j) => matches(j, q));
  }, [jobs, mergedQuery]);

  // 排序：updatedAt 倒序，回退 fetchedAt
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort(
      (a, b) => (b.updatedAt ?? b.fetchedAt) - (a.updatedAt ?? a.fetchedAt)
    );
  }, [filteredJobs]);

  const selectedJob = selectedId ? jobs.find((j) => j.id === selectedId) ?? null : null;

  // --- 详情操作 ---
  const handleStatusChange = async (s: JobStatus) => {
    if (!selectedJob?.id) return;
    await jobRepository.updateStatus(selectedJob.id, s);
    await refresh();
  };

  const handleAddTag = async (tag: string) => {
    if (!selectedJob?.id) return;
    await jobRepository.addTag(selectedJob.id, tag);
    await refresh();
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedJob?.id) return;
    await jobRepository.removeTag(selectedJob.id, tag);
    await refresh();
  };

  const handleNotesChange = async (notes: string) => {
    if (!selectedJob?.id) return;
    await jobRepository.updateNotes(selectedJob.id, notes);
    await refresh();
  };

  const handleDelete = async () => {
    if (!selectedJob?.id) return;
    await jobRepository.delete(selectedJob.id);
    setSelectedId(null);
    await refresh();
  };

  // --- 导入/导出 ---
  const handleExport = async () => {
    try {
      const payload = await exportAll({ jobs: jobRepository, settings: settingsRepository });
      const json = serializePayload(payload);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobbox-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('导出失败：' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = parsePayload(text);
        const result = await importAll(
          { jobs: jobRepository, settings: settingsRepository },
          payload
        );
        alert(`导入完成：成功 ${result.imported} 条，跳过 ${result.skipped} 条`);
        await refresh();
      } catch (e) {
        alert('导入失败：' + (e instanceof Error ? e.message : String(e)));
      }
    };
    input.click();
  };

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__brand">
          <h1 className="dashboard__title">JobBox 岗位库</h1>
          <span className="dashboard__count">共 {jobs.length} 个岗位</span>
        </div>
        <div className="dashboard__actions">
          <button className="btn" onClick={handleImport}>导入</button>
          <button className="btn" onClick={handleExport}>导出</button>
        </div>
      </header>

      <SearchBar
        keyword={keyword}
        status={status}
        total={jobs.length}
        filtered={sortedJobs.length}
        onKeywordChange={setKeyword}
        onStatusChange={setStatus}
      />

      <FilterPanel
        query={query}
        cities={cities}
        sources={sources}
        onChange={(patch) => setQuery((q) => ({ ...q, ...patch }))}
        onReset={() => setQuery({})}
      />

      <main className="dashboard__main">
        {loading && <p className="dashboard__hint">加载中…</p>}
        {error && <p className="dashboard__error">{error}</p>}
        {!loading && !error && sortedJobs.length === 0 && (
          <p className="dashboard__hint">
            {jobs.length === 0 ? '暂无岗位，去招聘页面点击 JobBox 保存吧～' : '没有符合条件的岗位'}
          </p>
        )}
        <div className="job-list">
          {sortedJobs.map((j) => (
            <JobListItem
              key={j.id}
              job={j}
              onClick={() => setSelectedId(j.id ?? null)}
            />
          ))}
        </div>
      </main>

      {selectedJob && (
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onNotesChange={handleNotesChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/** 内存内过滤：与 JobRepository.matches 保持一致（App 内联一份避免异步） */
function matches(job: Job, q: JobSearchQuery): boolean {
  if (q.keyword) {
    const kw = q.keyword.trim().toLowerCase();
    if (kw) {
      const tagStr = [...(job.tags ?? []), ...(job.autoTags ?? [])].join(' ');
      const hay = `${job.title} ${job.company} ${job.description} ${tagStr} ${job.notes ?? ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
  }
  if (q.city) {
    const c = q.city.trim();
    if (c) {
      const normCity = job.normalized?.location?.city;
      const ok = normCity ? normCity === c : job.location.includes(c);
      if (!ok) return false;
    }
  }
  if (q.salaryMin !== undefined || q.salaryMax !== undefined) {
    const sal = job.normalized?.salary;
    if (sal?.parsed) {
      if (q.salaryMin !== undefined && sal.min < q.salaryMin) return false;
      if (q.salaryMax !== undefined && sal.max > q.salaryMax) return false;
    }
  }
  if (q.education) {
    const edu = job.normalized?.education?.level;
    if (edu && edu !== q.education) return false;
  }
  if (q.experienceMin !== undefined || q.experienceMax !== undefined) {
    const exp = job.normalized?.experience;
    if (exp?.parsed) {
      if (q.experienceMin !== undefined && exp.min < q.experienceMin) return false;
      if (q.experienceMax !== undefined && exp.max > 0 && exp.max > q.experienceMax) return false;
    }
  }
  if (q.status) {
    if ((job.status ?? 'saved') !== q.status) return false;
  }
  if (q.tags && q.tags.length > 0) {
    const jobTags = job.tags ?? [];
    if (!q.tags.some((t) => jobTags.includes(t))) return false;
  }
  if (q.source) {
    if (job.source !== q.source) return false;
  }
  return true;
}
