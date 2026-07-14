import { useMemo, useState } from 'react';
import { color, font, radius } from '../theme';
import JobRow from './JobRow';

const COLUMNS = '28px 2.3fr 1fr 1.2fr 1fr 1.3fr 1.5fr 32px';

function StageTab({ tab, active, onSelect }) {
  return (
    <button type="button" onClick={onSelect} style={{ border: 'none', cursor: 'pointer', borderRadius: radius.input, padding: '7px 11px', font: `600 12px ${font.body}`, background: active ? color.ink : 'transparent', color: active ? '#fff' : color.textSecondary }}>
      {tab.stage} <span style={{ opacity: 0.55, fontWeight: 500 }}>{tab.count}</span>
    </button>
  );
}

export default function PipelineTable({
  jobs,
  totalCount,
  tabs,
  stageFilter,
  onSelectStage,
  onSelectJob,
  onEditJob,
  onDuplicateJob,
  onDeleteJob,
  onChangeStage,
  onReorderJobs,
  onMoveJob,
  onUpdateDraftField,
  onCommitDraft,
  onDiscardDraft,
}) {
  const [draggedJobId, setDraggedJobId] = useState(null);
  const [dragTargetId, setDragTargetId] = useState(null);
  const manageableIds = useMemo(() => jobs.filter(job => !job.isDraft).map(job => job.id), [jobs]);

  const dropJob = targetId => {
    if (!draggedJobId || draggedJobId === targetId) {
      setDraggedJobId(null);
      setDragTargetId(null);
      return;
    }

    const orderedIds = [...manageableIds];
    const sourceIndex = orderedIds.indexOf(draggedJobId);
    const targetIndex = orderedIds.indexOf(targetId);
    if (sourceIndex >= 0 && targetIndex >= 0) {
      orderedIds.splice(sourceIndex, 1);
      orderedIds.splice(targetIndex, 0, draggedJobId);
      onReorderJobs(orderedIds);
    }
    setDraggedJobId(null);
    setDragTargetId(null);
  };

  return (
    <div style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {tabs.map(tab => <StageTab key={tab.stage} tab={tab} active={tab.stage === stageFilter} onSelect={() => onSelectStage(tab.stage)} />)}
        </div>
        <div style={{ fontSize: 12, color: color.textMuted }}>Manual priority · drag to reorder</div>
      </div>

      <div role="row" style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 12, padding: '12px 18px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: color.textMuted, borderBottom: `1px solid ${color.rowDivider}` }}>
        <div aria-label="Priority" />
        <div>Role</div>
        <div>Stage</div>
        <div>Location</div>
        <div>Salary</div>
        <div>Contact</div>
        <div>Next action</div>
        <div aria-label="Actions" />
      </div>

      {jobs.length === 0 ? (
        <div style={{ padding: '42px 18px', textAlign: 'center' }}>
          <div style={{ font: `600 15px ${font.heading}`, color: color.ink }}>{stageFilter === 'All' ? 'Your pipeline is clear' : `No ${stageFilter.toLowerCase()} jobs`}</div>
          <div style={{ marginTop: 5, fontSize: 12.5, color: color.textSecondary }}>{stageFilter === 'All' ? 'Capture a job or save a scraper match to start tracking it.' : 'Move a job into this stage or choose another filter.'}</div>
        </div>
      ) : jobs.map((job, index) => {
        const manageableIndex = manageableIds.indexOf(job.id);
        return (
          <JobRow
            key={job.id}
            job={job}
            columns={COLUMNS}
            onSelect={() => onSelectJob(job.id)}
            onEdit={() => onEditJob(job.id)}
            onDuplicate={() => onDuplicateJob(job.id)}
            onDelete={() => onDeleteJob(job.id)}
            onChangeStage={stage => onChangeStage(job.id, stage)}
            onMoveUp={() => onMoveJob(job.id, -1, manageableIds)}
            onMoveDown={() => onMoveJob(job.id, 1, manageableIds)}
            canMoveUp={manageableIndex > 0}
            canMoveDown={manageableIndex >= 0 && manageableIndex < manageableIds.length - 1}
            onDragStart={() => setDraggedJobId(job.id)}
            onDragEnd={() => { setDraggedJobId(null); setDragTargetId(null); }}
            onDragOver={() => setDragTargetId(job.id)}
            onDrop={() => dropJob(job.id)}
            isDragTarget={dragTargetId === job.id && draggedJobId !== job.id}
            onUpdateDraftField={onUpdateDraftField}
            onCommitDraft={onCommitDraft}
            onDiscardDraft={onDiscardDraft}
          />
        );
      })}

      <div style={{ padding: '12px 18px', fontSize: 12, color: color.textMuted }}>Showing {jobs.length} of {totalCount} tracked jobs</div>
    </div>
  );
}
