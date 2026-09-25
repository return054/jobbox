// 岗位详情面板：查看完整信息 + 修改状态/标签/备注 + 删除
// 设计：
//   - 状态用按钮组切换（5 态）
//   - 标签分两栏：用户标签（可增删）与自动标签（只读，带"自动"标记）
//   - 备注用 textarea，失焦自动保存
//   - 删除按钮带二次确认
import { useEffect, useState } from 'react';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type Job,
  type JobStatus,
} from '../../types/job';
import type { InterpretationResult } from '../../core/interpreter/types';
import { splitByHits, CERTAINTY_COLORS } from '../../utils/highlight';

const STATUSES: JobStatus[] = ['saved', 'applied', 'interview', 'rejected', 'offer'];

interface Props {
  job: Job;
  onClose: () => void;
  onStatusChange: (status: JobStatus) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onNotesChange: (notes: string) => void;
  onDelete: () => void;
}

export default function JobDetail({
  job,
  onClose,
  onStatusChange,
  onAddTag,
  onRemoveTag,
  onNotesChange,
  onDelete,
}: Props) {
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState(job.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // job 切换时同步 notes
  useEffect(() => {
    setNotes(job.notes ?? '');
  }, [job.id, job.notes]);

  const status: JobStatus = job.status ?? 'saved';
  const userTags = job.tags ?? [];
  const autoTags = job.autoTags ?? [];
  const interp: InterpretationResult | undefined = job.interpretation;

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    onAddTag(t);
    setTagInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <aside className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <header className="detail-panel__header">
          <h2 className="detail-panel__title">{job.title}</h2>
          <button className="detail-panel__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <section className="detail-panel__section">
          <div className="detail-panel__company">{job.company}</div>
          <div className="detail-panel__row">
            <span className="detail-panel__salary">{job.salary || '薪资面议'}</span>
            <span className="detail-panel__location">{job.location || '地点未知'}</span>
            <span className="detail-panel__source">来源：{job.source}</span>
          </div>
          <a
            className="detail-panel__url"
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {job.sourceUrl}
          </a>
        </section>

        <section className="detail-panel__section">
          <h4 className="detail-panel__subtitle">申请状态</h4>
          <div className="status-group">
            {STATUSES.map((s) => {
              const active = status === s;
              return (
                <button
                  key={s}
                  className={`status-btn ${active ? 'status-btn--active' : ''}`}
                  style={active ? { backgroundColor: JOB_STATUS_COLORS[s], borderColor: JOB_STATUS_COLORS[s] } : undefined}
                  onClick={() => onStatusChange(s)}
                >
                  {JOB_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
        </section>

        <section className="detail-panel__section">
          <h4 className="detail-panel__subtitle">标签</h4>
          {autoTags.length > 0 && (
            <div className="detail-panel__tag-row">
              <span className="detail-panel__tag-label">自动</span>
              {autoTags.map((t) => (
                <span key={`a-${t}`} className="tag tag--auto">{t}</span>
              ))}
            </div>
          )}
          <div className="detail-panel__tag-row">
            <span className="detail-panel__tag-label">我的</span>
            {userTags.length === 0 && <span className="detail-panel__empty">暂无标签</span>}
            {userTags.map((t) => (
              <span key={`u-${t}`} className="tag tag--user">
                {t}
                <button
                  className="tag__remove"
                  onClick={() => onRemoveTag(t)}
                  aria-label={`移除标签 ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="detail-panel__tag-input">
            <input
              type="text"
              placeholder="输入标签后回车"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button onClick={handleAddTag}>添加</button>
          </div>
        </section>

        <section className="detail-panel__section">
          <h4 className="detail-panel__subtitle">备注</h4>
          <textarea
            className="detail-panel__notes"
            placeholder="记录面试反馈、薪资谈判、待办事项…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onNotesChange(notes)}
          />
        </section>

        {interp && interp.hits.length > 0 && (
          <section className="detail-panel__section">
            <h4 className="detail-panel__subtitle">潜台词解读</h4>

            {interp.publicInfo.length > 0 && (
              <div className="interp-layer interp-layer--a">
                <div className="interp-layer__title">📌 公开信息（原文明确陈述）</div>
                {interp.publicInfo.map((h) => (
                  <div key={`a-${h.phraseId}`} className="interp-item">
                    <span className="interp-item__phrase" style={{ backgroundColor: CERTAINTY_COLORS[h.certainty] }}>
                      {h.matchedText}
                    </span>
                    <span className="interp-item__text">{h.interpretation}</span>
                  </div>
                ))}
              </div>
            )}

            {interp.commonMeaning.length > 0 && (
              <div className="interp-layer interp-layer--b">
                <div className="interp-layer__title">💡 常见含义（行业黑话）</div>
                {interp.commonMeaning.map((h) => (
                  <div key={`b-${h.phraseId}`} className="interp-item">
                    <span className="interp-item__phrase" style={{ backgroundColor: CERTAINTY_COLORS[h.certainty] }}>
                      {h.matchedText}
                    </span>
                    <span className="interp-item__text">{h.interpretation}</span>
                  </div>
                ))}
              </div>
            )}

            {interp.toConfirm.length > 0 && (
              <div className="interp-layer interp-layer--c">
                <div className="interp-layer__title">❓ 待确认事项</div>
                {interp.toConfirm.map((h) => (
                  <div key={`c-${h.phraseId}`} className="interp-item">
                    <span className="interp-item__phrase" style={{ backgroundColor: CERTAINTY_COLORS[h.certainty] }}>
                      {h.matchedText}
                    </span>
                    <span className="interp-item__text">{h.interpretation}</span>
                  </div>
                ))}
                {interp.pendingQuestions.length > 0 && (
                  <div className="interp-questions">
                    <strong>建议向 HR 确认：</strong>
                    <ul>
                      {interp.pendingQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <section className="detail-panel__section">
          <h4 className="detail-panel__subtitle">岗位描述{interp && interp.hits.length > 0 ? '（高亮为命中短语）' : ''}</h4>
          {job.description ? (
            <p className="detail-panel__desc">
              {splitByHits(job.description, interp?.hits ?? []).map((seg, i) =>
                seg.highlight ? (
                  <mark
                    key={i}
                    className="desc-highlight"
                    style={{ backgroundColor: CERTAINTY_COLORS[seg.certainty ?? 'C'] }}
                    title={`证据等级：${seg.certainty}`}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </p>
          ) : (
            <p className="detail-panel__desc">（无）</p>
          )}
        </section>

        <footer className="detail-panel__footer">
          {!confirmDelete ? (
            <button
              className="detail-panel__delete"
              onClick={() => setConfirmDelete(true)}
            >
              删除岗位
            </button>
          ) : (
            <div className="detail-panel__confirm">
              <span>确认删除该岗位？</span>
              <button className="btn-danger" onClick={onDelete}>确认删除</button>
              <button className="btn-cancel" onClick={() => setConfirmDelete(false)}>取消</button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}
