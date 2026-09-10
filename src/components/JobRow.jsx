import { useState } from 'react';
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

function JobTitle({ job, mobile = false }) {
  const href = externalJobUrl(job.url);
  const style = {
    display: 'block',
    color: href ? color.accent : color.ink,
    font: mobile ? `650 15px ${font.heading}` : undefined,
    fontSize: mobile ? undefined : 13.5,
    fontWeight: mobile ? undefined : 650,
    lineHeight: mobile ? 1.25 : undefined,
    textDecoration: href ? 'underline' : 'none',
    textDecorationThickness: href ? '1px' : undefined,
    textUnderlineOffset: href ? 2 : undefined,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  if (!href) return <span style={style}>{job.role}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${job.role} at ${job.company || 'company not set'} job posting in a new tab`}
      onClick={event => event.stopPropagation()}
      style={style}
    >
      {job.role} ↗
    </a>
  );
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
          {fields.map(([field, placeholder], index) => <input key={field} aria-label={`Draft ${field}`} style={{ ...draftFieldStyle, gridColumn: index < 2 ? '1 / -1' : 'auto' }} placeholder={placeholder} value={job[field]} onChange={event => onUpdateDraftField(job.id, field, event.target.value)} />)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => onCommitDraft(job.id)} style={{ flex: 1, minHeight: 42, border: 'none', borderRadius: radius.input, background: color.accent, color: '#fff', font: `600 12px ${font.body}`, cursor: 'pointer' }}>Save job</button><button type="button" onClick={() => onDiscardDraft(job.id)} style={{ minHeight: 42, border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.cardBg, color: color.textMuted, padding: '0 12px', cursor: 'pointer' }}>Discard</button></div>
      </div>
    );
  }

  return (
    <div role="row" style={{ display: 'grid', gridTemplateColumns: columns, gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${color.rowDivider}`, background: color.inputBg }}>
      <div />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><input aria-label="Draft role" style={draftFieldStyle} placeholder="Role" value={job.role} onChange={event => onUpdateDraftField(job.id, 'role', event.target.value)} /><input aria-label="Draft company" style={draftFieldStyle} placeholder="Company" value={job.company} onChange={event => onUpdateDraftField(job.id, 'company', event.target.value)} /><input aria-label="Draft location" style={draftFieldStyle} placeholder="Location" value={job.location} onChange={event => onUpdateDraftField(job.id, 'location', event.target.value)} /></div>
      <span style={{ width: 'fit-content', borderRadius: radius.pill, padding: '4px 8px', fontSize: 10.5, fontWeight: 600, background: chipColor.Saved.bg, color: chipColor.Saved.fg }}>Draft</span>
      <input aria-label="Draft salary" style={draftFieldStyle} placeholder="Salary" value={job.salary} onChange={event => onUpdateDraftField(job.id, 'salary', event.target.value)} />
      <input aria-label="Draft contact" style={draftFieldStyle} placeholder="Contact" value={job.contact} onChange={event => onUpdateDraftField(job.id, 'contact', event.target.value)} />
      <div style={{ display: 'flex', gap: 5 }}><button type="button" onClick={() => onCommitDraft(job.id)} style={{ border: 'none', borderRadius: radius.badge, background: color.accent, color: '#fff', font: `600 11px ${font.body}`, padding: '6px 8px', cursor: 'pointer' }}>Save</button><button type="button" onClick={() => onDiscardDraft(job.id)} style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.badge, background: '#fff', color: color.textMuted, font: `500 11px ${font.body}`, padding: '6px 8px', cursor: 'pointer' }}>Discard</button></div>
      <div style={{ color: color.textSecondary, font: `500 10px ${font.utility}` }}>{formatSavedDate(job.createdAt)}</div><div />
    </div>
  );
}

export default function JobRow({ job, columns, layoutMode, onSelect, onEdit, onDuplicate, onDelete, onChangeStage, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onDragStart, onDragEnd, onDragOver, onDrop, isDragTarget, onUpdateDraftField, onCommitDraft, onDiscardDraft }) {
  const [hovered, setHovered] = useState(false);
  const mobile = layoutMode === 'mobile';

  if (job.isDraft) return <DraftJobRow job={job} columns={columns} mobile={mobile} onUpdateDraftField={onUpdateDraftField} onCommitDraft={onCommitDraft} onDiscardDraft={onDiscardDraft} />;

  const keyboardSelect = event => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); }
  };

  if (mobile) {
    return (
      <article role="group" tabIndex={0} aria-label={`${job.role} at ${job.company}`} onClick={onSelect} onKeyDown={keyboardSelect} style={{ padding: 14, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, background: color.cardBg, boxShadow: shadow.card, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}><JobTitle job={job} mobile /><span style={{ display: 'block', marginTop: 3, color: color.textSecondary, fontSize: 12.5 }}>{job.company || 'Company not set'}</span></div>
          <JobActionsMenu onEdit={onEdit} onDuplicate={onDuplicate} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}><StageSelect job={job} onChangeStage={onChangeStage} /><span style={{ color: color.textMuted, font: `500 10px ${font.utility}` }}>Saved {formatSavedDate(job.createdAt)}</span></div>
        <div style={{ marginTop: 12, padding: '10px 11px', borderLeft: `3px solid ${job.urgent ? color.urgent : color.accent}`, borderRadius: `0 ${radius.input}px ${radius.input}px 0`, background: job.urgent ? '#fbefed' : color.inputBg }}><div style={{ color: color.textMuted, font: `600 9px ${font.utility}`, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Next action</div><div style={{ marginTop: 4, color: job.urgent ? color.urgent : color.textBodyMid, fontSize: 12.5, fontWeight: job.urgent ? 650 : 500 }}>{job.next || 'No next action set'}</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', marginTop: 12, color: color.textSecondary, fontSize: 11.5 }}><span>{job.location || 'Location —'}</span><span>{job.salary || 'Compensation —'}</span><span style={{ gridColumn: '1 / -1' }}>{job.contact || 'Contact —'}</span></div>
      </article>
    );
  }

  return (
    <div role="row" tabIndex={0} aria-label={`${job.role} at ${job.company}`} onClick={onSelect} onKeyDown={keyboardSelect} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onDragOver={event => { event.preventDefault(); onDragOver(); }} onDrop={event => { event.preventDefault(); onDrop(); }} style={{ display: 'grid', gridTemplateColumns: columns, gap: 8, alignItems: 'center', padding: '13px 14px', borderBottom: `1px solid ${isDragTarget ? color.accent : color.rowDivider}`, cursor: 'pointer', background: hovered || isDragTarget ? color.inputBg : 'transparent', transition: 'background 120ms ease, border-color 120ms ease' }}>
      <button type="button" draggable aria-label={`Drag ${job.role} to reorder`} title="Drag to reorder" onClick={event => event.stopPropagation()} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', job.id); onDragStart(); }} onDragEnd={onDragEnd} style={{ border: 'none', background: 'transparent', color: hovered ? color.textSecondary : color.textMuted, cursor: 'grab', fontSize: 15, letterSpacing: '-2px', padding: 0 }}>⋮⋮</button>
      <div style={{ minWidth: 0 }}><JobTitle job={job} /><div style={{ marginTop: 2, color: color.textSecondary, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.company || 'Company not set'}{job.location ? ` · ${job.location}` : ''}</div></div>
      <StageSelect job={job} onChangeStage={onChangeStage} />
      <div style={{ color: color.textBodyMid, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.salary || '—'}</div>
      <div style={{ color: color.textBodyMid, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.contact || '—'}</div>
      <div style={{ color: job.urgent ? color.urgent : color.textBodyMid, fontSize: 11.5, fontWeight: job.urgent ? 650 : 400, lineHeight: 1.35 }}>{job.next || '—'}</div>
      <div style={{ color: color.textSecondary, font: `500 10px ${font.utility}`, lineHeight: 1.35 }}>{formatSavedDate(job.createdAt)}</div>
      <JobActionsMenu onEdit={onEdit} onDuplicate={onDuplicate} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
    </div>
  );
}
