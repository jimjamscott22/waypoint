import { useState } from 'react';
import { JOB_STAGES } from '../lib/seedData';
import { color, chipColor, font, radius } from '../theme';
import JobActionsMenu from './JobActionsMenu';

function DraftJobRow({ job, columns, onUpdateDraftField, onCommitDraft, onDiscardDraft }) {
  const fieldStyle = {
    border: `1px solid ${color.inputBorder}`,
    borderRadius: radius.badge,
    padding: '4px 6px',
    font: `400 12.5px ${font.body}`,
    color: color.ink,
    width: '100%',
    outline: 'none',
  };

  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 12,
        alignItems: 'center',
        padding: '10px 18px',
        borderBottom: `1px solid ${color.rowDivider}`,
        background: color.inputBg,
      }}
    >
      <div />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input aria-label="Draft role" style={fieldStyle} placeholder="Role" value={job.role} onChange={event => onUpdateDraftField(job.id, 'role', event.target.value)} />
        <input aria-label="Draft company" style={fieldStyle} placeholder="Company" value={job.company} onChange={event => onUpdateDraftField(job.id, 'company', event.target.value)} />
      </div>
      <div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: radius.pill, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, background: chipColor.Saved.bg, color: chipColor.Saved.fg }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: chipColor.Saved.fg }} /> Saved
        </span>
      </div>
      <input aria-label="Draft location" style={fieldStyle} placeholder="Location" value={job.location} onChange={event => onUpdateDraftField(job.id, 'location', event.target.value)} />
      <input aria-label="Draft salary" style={fieldStyle} placeholder="Salary" value={job.salary} onChange={event => onUpdateDraftField(job.id, 'salary', event.target.value)} />
      <input aria-label="Draft contact" style={fieldStyle} placeholder="Contact" value={job.contact} onChange={event => onUpdateDraftField(job.id, 'contact', event.target.value)} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => onCommitDraft(job.id)} style={{ border: 'none', borderRadius: radius.badge, background: color.accent, color: '#fff', font: `600 11.5px ${font.body}`, padding: '5px 10px', cursor: 'pointer' }}>Save</button>
        <button type="button" onClick={() => onDiscardDraft(job.id)} style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.badge, background: '#fff', color: color.textMuted, font: `500 11.5px ${font.body}`, padding: '5px 10px', cursor: 'pointer' }}>Discard</button>
      </div>
      <div />
    </div>
  );
}

export default function JobRow({
  job,
  columns,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onChangeStage,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragTarget,
  onUpdateDraftField,
  onCommitDraft,
  onDiscardDraft,
}) {
  const [hovered, setHovered] = useState(false);

  if (job.isDraft) {
    return <DraftJobRow job={job} columns={columns} onUpdateDraftField={onUpdateDraftField} onCommitDraft={onCommitDraft} onDiscardDraft={onDiscardDraft} />;
  }

  const chip = chipColor[job.stage] ?? chipColor.Saved;

  return (
    <div
      role="row"
      tabIndex={0}
      aria-label={`${job.role} at ${job.company}`}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={event => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={event => {
        event.preventDefault();
        onDrop();
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 12,
        alignItems: 'center',
        padding: '13px 18px',
        borderBottom: `1px solid ${isDragTarget ? color.accent : color.rowDivider}`,
        cursor: 'pointer',
        background: hovered || isDragTarget ? color.inputBg : 'transparent',
        transition: 'background 120ms ease, border-color 120ms ease',
        outlineColor: color.accent,
        outlineOffset: -2,
      }}
    >
      <button
        type="button"
        draggable
        aria-label={`Drag ${job.role} to reorder`}
        title="Drag to reorder"
        onClick={event => event.stopPropagation()}
        onDragStart={event => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', job.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        style={{ border: 'none', background: 'transparent', color: hovered ? color.textSecondary : color.textMuted, cursor: 'grab', fontSize: 16, letterSpacing: '-2px', padding: 0 }}
      >
        ⋮⋮
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.role}</div>
        <div style={{ fontSize: 12, color: color.textSecondary }}>{job.company}</div>
      </div>
      <div onClick={event => event.stopPropagation()} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
        <span style={{ position: 'absolute', left: 10, width: 5, height: 5, borderRadius: '50%', background: chip.fg, pointerEvents: 'none', zIndex: 1 }} />
        <select
          aria-label={`Stage for ${job.role}`}
          value={job.stage}
          onChange={event => onChangeStage(event.target.value)}
          style={{ appearance: 'none', border: 'none', borderRadius: radius.pill, padding: '3px 24px 3px 21px', font: `600 11.5px ${font.body}`, background: chip.bg, color: chip.fg, cursor: 'pointer', outlineColor: color.accent }}
        >
          {JOB_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
        </select>
        <span aria-hidden="true" style={{ position: 'absolute', right: 8, color: chip.fg, fontSize: 9, pointerEvents: 'none' }}>▼</span>
      </div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.location}</div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.salary}</div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.contact}</div>
      <div style={{ fontSize: 12.5, fontWeight: job.urgent ? 600 : 400, color: job.urgent ? color.urgent : color.textBodyMid }}>{job.next}</div>
      <div>
        <JobActionsMenu
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      </div>
    </div>
  );
}
