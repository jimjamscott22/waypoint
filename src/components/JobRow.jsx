import { useState } from 'react';
import { color, chipColor, font, radius } from '../theme';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input style={fieldStyle} placeholder="Role" value={job.role} onChange={e => onUpdateDraftField(job.id, 'role', e.target.value)} />
        <input style={fieldStyle} placeholder="Company" value={job.company} onChange={e => onUpdateDraftField(job.id, 'company', e.target.value)} />
      </div>
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: radius.pill,
            padding: '3px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            background: chipColor.Saved.bg,
            color: chipColor.Saved.fg,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: chipColor.Saved.fg }} />
          Saved
        </span>
      </div>
      <input style={fieldStyle} placeholder="Location" value={job.location} onChange={e => onUpdateDraftField(job.id, 'location', e.target.value)} />
      <input style={fieldStyle} placeholder="Salary" value={job.salary} onChange={e => onUpdateDraftField(job.id, 'salary', e.target.value)} />
      <input style={fieldStyle} placeholder="Contact" value={job.contact} onChange={e => onUpdateDraftField(job.id, 'contact', e.target.value)} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onCommitDraft(job.id)}
          style={{ border: 'none', borderRadius: radius.badge, background: color.accent, color: '#fff', font: `600 11.5px ${font.body}`, padding: '5px 10px', cursor: 'pointer' }}
        >
          Save
        </button>
        <button
          onClick={() => onDiscardDraft(job.id)}
          style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.badge, background: '#fff', color: color.textMuted, font: `500 11.5px ${font.body}`, padding: '5px 10px', cursor: 'pointer' }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

export default function JobRow({ job, columns, onSelect, onUpdateDraftField, onCommitDraft, onDiscardDraft }) {
  const [hovered, setHovered] = useState(false);

  if (job.isDraft) {
    return (
      <DraftJobRow
        job={job}
        columns={columns}
        onUpdateDraftField={onUpdateDraftField}
        onCommitDraft={onCommitDraft}
        onDiscardDraft={onDiscardDraft}
      />
    );
  }

  const chip = chipColor[job.stage];

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 12,
        alignItems: 'center',
        padding: '13px 18px',
        borderBottom: `1px solid ${color.rowDivider}`,
        cursor: 'pointer',
        background: hovered ? color.inputBg : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {job.role}
        </div>
        <div style={{ fontSize: 12, color: color.textSecondary }}>{job.company}</div>
      </div>
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: radius.pill,
            padding: '3px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            background: chip.bg,
            color: chip.fg,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: chip.fg }} />
          {job.stage}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.location}</div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.salary}</div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.contact}</div>
      <div style={{ fontSize: 12.5, fontWeight: job.urgent ? 600 : 400, color: job.urgent ? color.urgent : color.textBodyMid }}>
        {job.next}
      </div>
    </div>
  );
}
