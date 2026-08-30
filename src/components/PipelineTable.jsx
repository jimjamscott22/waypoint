import { useMemo, useState } from 'react';
import { color, font, radius, shadow } from '../theme';
import JobRow from './JobRow';

const COLUMNS = '28px minmax(175px, 2.2fr) minmax(96px, .9fr) minmax(92px, .9fr) minmax(104px, 1fr) minmax(138px, 1.35fr) minmax(104px, .9fr) 32px';

export default function PipelineTable({
  jobs,
  totalCount,
  stageFilter,
  layoutMode,
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
  const mobile = layoutMode === 'mobile';

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

  const rows = jobs.map(job => {
    const manageableIndex = manageableIds.indexOf(job.id);
    return (
      <JobRow
        key={job.id}
        job={job}
        columns={COLUMNS}
        layoutMode={layoutMode}
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
  });

  if (mobile) {
    return (
      <section aria-label="Job pipeline" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div><h2 style={{ margin: 0, color: color.ink, font: `650 16px ${font.heading}` }}>{stageFilter === 'All' ? 'Priority list' : stageFilter}</h2><div style={{ marginTop: 3, color: color.textMuted, font: `500 10px ${font.utility}` }}>{jobs.length} of {totalCount} tracked</div></div>
          <span style={{ color: color.textMuted, fontSize: 10.5 }}>Move from the action menu</span>
        </div>
        {jobs.length ? rows : <EmptyState stageFilter={stageFilter} />}
      </section>
    );
  }

  return (
    <section aria-label="Job pipeline" style={{ minWidth: 0, background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, overflow: 'visible', display: 'flex', flexDirection: 'column', boxShadow: shadow.card }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '15px 18px 12px', borderBottom: `1px solid ${color.rowDivider}` }}>
        <div><h2 style={{ margin: 0, color: color.ink, font: `650 15px ${font.heading}` }}>{stageFilter === 'All' ? 'Priority list' : `${stageFilter} jobs`}</h2><div style={{ marginTop: 2, color: color.textMuted, font: `500 10px ${font.utility}` }}>{jobs.length} of {totalCount} tracked</div></div>
        <div style={{ color: color.textMuted, fontSize: 11 }}>Manual priority · drag to reorder</div>
      </div>

      <div style={{ minWidth: 0, overflowX: 'auto', overflowY: 'visible' }}>
        <div style={{ minWidth: 760 }}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 8, padding: '10px 14px 8px', color: color.textMuted, font: `600 9px ${font.utility}`, letterSpacing: '0.65px', textTransform: 'uppercase', borderBottom: `1px solid ${color.rowDivider}` }}>
            <div aria-label="Priority" /><div>Opportunity</div><div>Stage</div><div>Compensation</div><div>Contact</div><div>Next action</div><div>Date saved</div><div aria-label="Actions" />
          </div>
          {jobs.length ? rows : <EmptyState stageFilter={stageFilter} />}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ stageFilter }) {
  return (
    <div style={{ padding: '42px 18px', textAlign: 'center', background: color.cardBg, borderRadius: radius.card, border: `1px dashed ${color.dashedBorder}` }}>
      <div style={{ font: `650 15px ${font.heading}`, color: color.ink }}>{stageFilter === 'All' ? 'Your route is clear' : `No ${stageFilter.toLowerCase()} jobs`}</div>
      <div style={{ marginTop: 5, fontSize: 12.5, color: color.textSecondary }}>{stageFilter === 'All' ? 'Capture a job or save a review match to begin.' : 'Choose another route stage or move a job here.'}</div>
    </div>
  );
}
