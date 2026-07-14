import { useEffect, useRef, useState } from 'react';
import { JOB_STAGES } from '../lib/seedData';
import { color, font, radius } from '../theme';

function toForm(job) {
  return {
    role: job.role ?? '',
    company: job.company ?? '',
    stage: job.stage ?? 'Saved',
    location: job.location ?? '',
    salary: job.salary ?? '',
    contact: job.contact ?? '',
    next: job.next ?? '',
    urgent: Boolean(job.urgent),
    url: job.url ?? '',
    notes: job.notes ?? '',
  };
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.7px',
  textTransform: 'uppercase',
  color: color.textMuted,
};

const inputStyle = {
  border: `1px solid ${color.inputBorder}`,
  borderRadius: radius.input,
  background: color.inputBg,
  color: color.ink,
  font: `400 13px ${font.body}`,
  outlineColor: color.accent,
  padding: '9px 10px',
  textTransform: 'none',
  letterSpacing: 0,
  width: '100%',
};

function ActionButton({ children, onClick, primary = false, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: primary ? 'none' : `1px solid ${danger ? '#e7bbb7' : color.inputBorder}`,
        borderRadius: radius.input,
        background: primary ? color.accent : '#fff',
        color: primary ? '#fff' : danger ? color.urgent : color.textBodyMid,
        cursor: 'pointer',
        font: `600 12.5px ${font.body}`,
        padding: '8px 12px',
      }}
    >
      {children}
    </button>
  );
}

export default function JobDetailPanel({ job, initialMode, onClose, onSave, onDuplicate, onDelete }) {
  const [mode, setMode] = useState(initialMode ?? 'view');
  const [form, setForm] = useState(() => toForm(job));
  const [errors, setErrors] = useState({});
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const returnFocusTo = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (returnFocusTo instanceof HTMLElement) returnFocusTo.focus();
    };
  }, [job.id]);

  const updateField = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors(previous => ({ ...previous, [field]: null }));
  };

  const save = () => {
    const nextErrors = {};
    if (!form.role.trim()) nextErrors.role = 'Role is required.';
    if (!form.company.trim()) nextErrors.company = 'Company is required.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const cleanedForm = { ...form, role: form.role.trim(), company: form.company.trim() };
    onSave(job.id, cleanedForm);
    setForm(cleanedForm);
    setMode('view');
  };

  const cancel = () => {
    setForm(toForm(job));
    setErrors({});
    setMode('view');
  };

  const handlePanelKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = panelRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const fields = [
    ['Company', job.company],
    ['Stage', job.stage],
    ['Location', job.location],
    ['Salary', job.salary],
    ['Contact', job.contact],
    ['Next action', job.next],
    ['Urgent', job.urgent ? 'Yes' : 'No'],
    ['URL', job.url],
    ['Notes', job.notes],
  ];

  return (
    <div onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(28,39,52,0.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 20 }}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-panel-title"
        onKeyDown={handlePanelKeyDown}
        style={{ width: 410, background: color.cardBg, height: '100%', padding: 28, display: 'flex', flexDirection: 'column', gap: 18, borderLeft: `1px solid ${color.cardBorder}`, boxShadow: '-18px 0 44px rgba(28,39,52,0.12)', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div id="job-panel-title" style={{ font: `600 18px ${font.heading}`, lineHeight: 1.25 }}>{mode === 'edit' ? 'Edit job' : job.role}</div>
            <div style={{ fontSize: 13, color: color.textSecondary }}>{mode === 'edit' ? 'Update the details that keep this application moving.' : job.company}</div>
          </div>
          <button ref={closeButtonRef} type="button" aria-label="Close job details" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, color: color.textMuted, cursor: 'pointer', padding: 1 }}>×</button>
        </div>

        {mode === 'edit' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <label style={labelStyle}>Role
              <input autoFocus value={form.role} onChange={event => updateField('role', event.target.value)} style={{ ...inputStyle, borderColor: errors.role ? color.urgent : color.inputBorder }} />
              {errors.role ? <span style={{ color: color.urgent, fontSize: 11, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>{errors.role}</span> : null}
            </label>
            <label style={labelStyle}>Company
              <input value={form.company} onChange={event => updateField('company', event.target.value)} style={{ ...inputStyle, borderColor: errors.company ? color.urgent : color.inputBorder }} />
              {errors.company ? <span style={{ color: color.urgent, fontSize: 11, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>{errors.company}</span> : null}
            </label>
            <label style={labelStyle}>Stage
              <select value={form.stage} onChange={event => updateField('stage', event.target.value)} style={inputStyle}>{JOB_STAGES.map(stage => <option key={stage}>{stage}</option>)}</select>
            </label>
            <label style={labelStyle}>Location<input value={form.location} onChange={event => updateField('location', event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Salary<input value={form.salary} onChange={event => updateField('salary', event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Contact<input value={form.contact} onChange={event => updateField('contact', event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Next action<input value={form.next} onChange={event => updateField('next', event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>URL<input type="url" value={form.url} onChange={event => updateField('url', event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Notes<textarea rows={4} value={form.notes} onChange={event => updateField('notes', event.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: color.textBodyMid, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.urgent} onChange={event => updateField('urgent', event.target.checked)} style={{ accentColor: color.accent }} /> Mark next action as urgent
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {fields.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: color.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, color: color.textBodyMid, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value || '—'}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${color.rowDivider}` }}>
          {mode === 'edit' ? (
            <>
              <ActionButton onClick={cancel}>Cancel</ActionButton>
              <ActionButton onClick={save} primary>Save changes</ActionButton>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <ActionButton onClick={() => setMode('edit')} primary>Edit</ActionButton>
                <ActionButton onClick={() => onDuplicate(job.id)}>Duplicate</ActionButton>
              </div>
              <ActionButton onClick={() => onDelete(job.id)} danger>Delete</ActionButton>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
