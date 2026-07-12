import { color, font, radius } from '../theme';
import JobRow from './JobRow';

const COLUMNS = '2.3fr 1fr 1.2fr 1fr 1.3fr 1.5fr';

function StageTab({ tab, active, onSelect }) {
  return (
    <button
      onClick={onSelect}
      style={{
        border: 'none',
        cursor: 'pointer',
        borderRadius: radius.input,
        padding: '7px 13px',
        font: `600 12.5px ${font.body}`,
        background: active ? color.ink : 'transparent',
        color: active ? '#fff' : color.textSecondary,
      }}
    >
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
  onUpdateDraftField,
  onCommitDraft,
  onDiscardDraft,
}) {
  return (
    <div style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(tab => (
            <StageTab key={tab.stage} tab={tab} active={tab.stage === stageFilter} onSelect={() => onSelectStage(tab.stage)} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: color.textMuted }}>Sorted by last activity</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          gap: 12,
          padding: '12px 18px 8px',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.7px',
          textTransform: 'uppercase',
          color: color.textMuted,
          borderBottom: `1px solid ${color.rowDivider}`,
        }}
      >
        <div>Role</div>
        <div>Stage</div>
        <div>Location</div>
        <div>Salary</div>
        <div>Contact</div>
        <div>Next action</div>
      </div>

      {jobs.map(job => (
        <JobRow
          key={job.id}
          job={job}
          columns={COLUMNS}
          onSelect={() => onSelectJob(job.id)}
          onUpdateDraftField={onUpdateDraftField}
          onCommitDraft={onCommitDraft}
          onDiscardDraft={onDiscardDraft}
        />
      ))}

      <div style={{ padding: '12px 18px', fontSize: 12, color: color.textMuted }}>
        Showing {jobs.length} of {totalCount} tracked jobs
      </div>
    </div>
  );
}
