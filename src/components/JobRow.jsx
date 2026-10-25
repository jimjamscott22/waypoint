import { Children, useState } from 'react';
import { JOB_STAGES } from '../lib/seedData';
import { formatSavedDate } from '../lib/dateTime';
import { externalJobUrl } from '../lib/jobUrl';
import { color, chipColor, font, radius, shadow } from '../theme';
import JobActionsMenu from './JobActionsMenu';

const draftFieldStyle = {
  border: `1px solid ${color.inputBorder}`,
  borderRadius: radius.badge,
  padding: '7px 8px',
  minHeight: 36,
  font: `400 12.5px ${font.body}`,
  color: color.ink,
  background: color.cardBg,
  width: '100%',
  outline: 'none',
};

function StageSelect({ job, onChangeStage }) {
  const chip = chipColor[job.stage] ?? chipColor.Saved;
  return (
    <div onClick={event => event.stopPropagation()} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
      <span style={{ position: 'absolute', left: 10, width: 5, height: 5, borderRadius: '50%', background: chip.fg, pointerEvents: 'none', zIndex: 1 }} />
      <select aria-label={`Stage for ${job.role}`} value={job.stage} onChange={event => onChangeStage(event.target.value)} style={{ appearance: 'none', minHeight: 32, border: 'none', borderRadius: radius.pill, padding: '5px 24px 5px 21px', font: `600 10.5px ${font.body}`, background: chip.bg, color: chip.fg, cursor: 'pointer' }}>
        {JOB_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
      </select>
      <span aria-hidden="true" style={{ position: 'absolute', right: 8, color: chip.fg, fontSize: 8, pointerEvents: 'none' }}>▼</span>
    </div>
  );
}

function JobTitle({ job, onSelect, mobile = false }) {
  const href = externalJobUrl(job.url);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      <button
        type="button"
        aria-label={`Open details for ${job.role} at ${job.company || 'company not set'}`}
        onClick={event => { event.stopPropagation(); onSelect(); }}
        style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', color: color.ink, textAlign: 'left', font: mobile ? `650 15px ${font.heading}` : `650 13.5px ${font.body}`, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >{job.role}</button>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${job.role} at ${job.company || 'company not set'} job posting in a new tab`} onClick={event => event.stopPropagation()} style={{ color: color.accent, textDecoration: 'none', flexShrink: 0, padding: '6px 2px' }}>↗</a>
      ) : null}
    </div>
  );
}

function TableRow({ children, ...props }) {
  return <div role="row" {...props}>{Children.map(children, child => <div role="cell" style={{ minWidth: 0 }}>{child}</div>)}</div>;
}

function DraftInput({ label, style, ...props }) {
  return <label style={{ minWidth: 0, gridColumn: style?.gridColumn }}><span data-visually-hidden>{label}</span><input {...props} style={style} /></label>;
}

function DraftJobRow({ job, columns, mobile, onUpdateDraftField, onCommitDraft, onDiscardDraft }) {
  const fields = [
    ['role', 'Role'], ['company', 'Company'], ['location', 'Location'], ['salary', 'Salary'], ['contact', 'Contact'],
  ];

  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, border: `1px solid ${color.accentLight}`, borderRadius: radius.card, background: color.inputBg, boxShadow: shadow.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><div style={{ color: color.accent, font: `600 9px ${font.utility}`, letterSpacing: '0.7px', textTransform: 'uppercase' }}>New capture</div><div style={{ marginTop: 3, color: color.textMuted, font: `500 10px ${font.utility}` }}>Saved {formatSavedDate(job.createdAt)}</div></div><span style={{ color: chipColor.Saved.fg, background: chipColor.Saved.bg, borderRadius: radius.pill, padding: '4px 8px', fontSize: 10, height: 'fit-content' }}>Draft</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {fields.map(([field, placeholder], index) => <DraftInput key={field} label={placeholder} style={{ ...draftFieldStyle, gridColumn: index < 2 ? '1 / -1' : 'auto' }} placeholder={placeholder} value={job[field]} onChange={event => onUpdateDraftField(job.id, field, event.target.value)} />)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => onCommitDraft(job.id)} style={{ flex: 1, minHeight: 42, border: 'none', borderRadius: radius.input, background: color.accent, color: color.onAccent, font: `600 12px ${font.body}`, cursor: 'pointer' }}>Save job</button><button type="button" onClick={() => onDiscardDraft(job.id)} style={{ minHeight: 42, border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.cardBg, color: color.textMuted, padding: '0 12px', cursor: 'pointer' }}>Discard</button></div>
      </div>
    );
  }

  return (
    <TableRow style={{ display: 'grid', gridTemplateColumns: columns, gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${color.rowDivider}`, background: color.inputBg }}>
      <div />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><DraftInput label="Role" style={draftFieldStyle} placeholder="Role" value={job.role} onChange={event => onUpdateDraftField(job.id, 'role', event.target.value)} /><DraftInput label="Company" style={draftFieldStyle} placeholder="Company" value={job.company} onChange={event => onUpdateDraftField(job.id, 'company', event.target.value)} /><DraftInput label="Location" style={draftFieldStyle} placeholder="Location" value={job.location} onChange={event => onUpdateDraftField(job.id, 'location', event.target.value)} /></div>
      <span style={{ width: 'fit-content', borderRadius: radius.pill, padding: '4px 8px', fontSize: 10.5, fontWeight: 600, background: chipColor.Saved.bg, color: chipColor.Saved.fg }}>Draft</span>
      <DraftInput label="Salary" style={draftFieldStyle} placeholder="Salary" value={job.salary} onChange={event => onUpdateDraftField(job.id, 'salary', event.target.value)} />
      <DraftInput label="Contact" style={draftFieldStyle} placeholder="Contact" value={job.contact} onChange={event => onUpdateDraftField(job.id, 'contact', event.target.value)} />
      <div style={{ display: 'flex', gap: 5 }}><button type="button" onClick={() => onCommitDraft(job.id)} style={{ border: 'none', borderRadius: radius.badge, background: color.accent, color: color.onAccent, font: `600 11px ${font.body}`, padding: '6px 8px', cursor: 'pointer' }}>Save</button><button type="button" onClick={() => onDiscardDraft(job.id)} style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.badge, background: color.cardBg, color: color.textMuted, font: `500 11px ${font.body}`, padding: '6px 8px', cursor: 'pointer' }}>Discard</button></div>
      <div style={{ color: color.textSecondary, font: `500 10px ${font.utility}` }}>{formatSavedDate(job.createdAt)}</div><div />
    </TableRow>
  );
}

export default function JobRow({ job, columns, layoutMode, onSelect, onEdit, onDuplicate, onDelete, onChangeStage, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onDragStart, onDragEnd, onDragOver, onDrop, isDragTarget, onUpdateDraftField, onCommitDraft, onDiscardDraft }) {
  const [hovered, setHovered] = useState(false);
  const mobile = layoutMode === 'mobile';

  if (job.isDraft) return <DraftJobRow job={job} columns={columns} mobile={mobile} onUpdateDraftField={onUpdateDraftField} onCommitDraft={onCommitDraft} onDiscardDraft={onDiscardDraft} />;

  if (mobile) {
    return (
      <article aria-label={`${job.role} at ${job.company}`} onClick={onSelect} style={{ padding: 14, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, background: color.cardBg, boxShadow: shadow.card, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}><JobTitle job={job} onSelect={onSelect} mobile /><span style={{ display: 'block', marginTop: 3, color: color.textSecondary, fontSize: 12.5 }}>{job.company || 'Company not set'}</span></div>
          <JobActionsMenu onEdit={onEdit} onDuplicate={onDuplicate} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}><StageSelect job={job} onChangeStage={onChangeStage} /><span style={{ color: color.textMuted, font: `500 10px ${font.utility}` }}>Saved {formatSavedDate(job.createdAt)}</span></div>
        <div style={{ marginTop: 12, padding: '10px 11px', borderLeft: `3px solid ${job.urgent ? color.urgent : color.accent}`, borderRadius: `0 ${radius.input}px ${radius.input}px 0`, background: job.urgent ? color.urgentSoft : color.inputBg }}><div style={{ color: color.textMuted, font: `600 9px ${font.utility}`, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Next action</div><div style={{ marginTop: 4, color: job.urgent ? color.urgent : color.textBodyMid, fontSize: 12.5, fontWeight: job.urgent ? 650 : 500 }}>{job.next || 'No next action set'}</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', marginTop: 12, color: color.textSecondary, fontSize: 11.5 }}><span>{job.location || 'Location —'}</span><span>{job.salary || 'Compensation —'}</span><span style={{ gridColumn: '1 / -1' }}>{job.contact || 'Contact —'}</span></div>
      </article>
    );
  }

  return (
    <TableRow aria-label={`${job.role} at ${job.company}`} onClick={onSelect} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onDragOver={event => { event.preventDefault(); onDragOver(); }} onDrop={event => { event.preventDefault(); onDrop(); }} style={{ display: 'grid', gridTemplateColumns: columns, gap: 8, alignItems: 'center', padding: '13px 14px', borderBottom: `1px solid ${isDragTarget ? color.accent : color.rowDivider}`, cursor: 'pointer', background: hovered || isDragTarget ? color.inputBg : 'transparent', transition: 'background 120ms ease, border-color 120ms ease' }}>
      <button type="button" draggable aria-label={`Drag ${job.role} to reorder`} title="Drag to reorder" onClick={event => event.stopPropagation()} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', job.id); onDragStart(); }} onDragEnd={onDragEnd} style={{ border: 'none', background: 'transparent', color: hovered ? color.textSecondary : color.textMuted, cursor: 'grab', fontSize: 15, letterSpacing: '-2px', padding: 0 }}>⋮⋮</button>
      <div style={{ minWidth: 0 }}><JobTitle job={job} onSelect={onSelect} /><div style={{ marginTop: 2, color: color.textSecondary, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.company || 'Company not set'}{job.location ? ` · ${job.location}` : ''}</div></div>
      <StageSelect job={job} onChangeStage={onChangeStage} />
      <div style={{ color: color.textBodyMid, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.salary || '—'}</div>
      <div style={{ color: color.textBodyMid, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.contact || '—'}</div>
      <div style={{ color: job.urgent ? color.urgent : color.textBodyMid, fontSize: 11.5, fontWeight: job.urgent ? 650 : 400, lineHeight: 1.35 }}>{job.next || '—'}</div>
      <div style={{ color: color.textSecondary, font: `500 10px ${font.utility}`, lineHeight: 1.35 }}>{formatSavedDate(job.createdAt)}</div>
      <JobActionsMenu onEdit={onEdit} onDuplicate={onDuplicate} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
    </TableRow>
  );
}
