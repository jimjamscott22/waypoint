import { useEffect, useId, useRef, useState } from 'react';
import { JOB_STAGES } from '../lib/seedData';
import { formatDateTime, formatNextActionDue, fromLocalDateTimeInput, toLocalDateTimeInput } from '../lib/dateTime';
import { externalJobUrl } from '../lib/jobUrl';
import { color, font, radius } from '../theme';
import JobEngagementPanel from './JobEngagementPanel';

function toForm(job) {
  return {
    role: job.role ?? '',
    company: job.company ?? '',
    stage: job.stage ?? 'Saved',
    location: job.location ?? '',
    salary: job.salary ?? '',
    contact: job.contact ?? '',
    next: job.next ?? '',
    nextActionAt: toLocalDateTimeInput(job.nextActionAt),
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

function ActionButton({ children, onClick, primary = false, danger = false, type = 'button', form, disabled = false }) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      style={{
        border: primary ? 'none' : `1px solid ${danger ? color.urgentBorder : color.inputBorder}`,
        borderRadius: radius.input,
        background: primary ? color.accent : color.cardBg,
        color: primary ? color.onAccent : danger ? color.urgent : color.textBodyMid,
        cursor: 'pointer',
        font: `600 12.5px ${font.body}`,
        minHeight: 42,
        padding: '8px 12px',
      }}
    >
      {children}
    </button>
  );
}

export default function JobDetailPanel({ job, initialMode, onClose, onSave, onDuplicate, onDelete, onEngagementChanged, layoutMode, onDialogElement }) {
  const [mode, setMode] = useState(initialMode ?? 'view');
  const [form, setForm] = useState(() => toForm(job));
  const [errors, setErrors] = useState({});
  const panelRef = useRef(null);
  const formRef = useRef(null);
  const formId = useId();
  const [saving, setSaving] = useState(false);
  const closeButtonRef = useRef(null);
  const mobile = layoutMode === 'mobile';
  const jobPostingUrl = externalJobUrl(job.url);

  useEffect(() => {
    const dialog = panelRef.current;
    const returnFocusTo = document.activeElement;
    let active = true;
    const closed = async () => {
      // StrictMode can reopen the dialog before a cleanup's queued close event.
      if (dialog.open) return;
      // Let discrete display/overlay transitions finish before React removes it.
      await Promise.allSettled(dialog.getAnimations().map(animation => animation.finished));
      if (active) onClose();
    };
    let startedOutside = false;
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    };
    const pointerDown = event => { startedOutside = outside(event); };
    const lightDismiss = event => {
      if (startedOutside && outside(event)) dialog.close();
      startedOutside = false;
    };
    dialog.addEventListener('close', closed);
    if (!('closedBy' in dialog)) {
      dialog.addEventListener('pointerdown', pointerDown);
      dialog.addEventListener('click', lightDismiss);
    }
    dialog.showModal();
    onDialogElement(dialog);
    closeButtonRef.current?.focus();
    return () => {
      active = false;
      dialog.removeEventListener('close', closed);
      dialog.removeEventListener('pointerdown', pointerDown);
      dialog.removeEventListener('click', lightDismiss);
      dialog.close();
      onDialogElement(null);
      if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) returnFocusTo.focus();
    };
  }, [job.id, onClose, onDialogElement]);

  useEffect(() => {
    if (mode === 'edit') formRef.current?.elements.role.focus();
  }, [mode]);

  const updateField = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors(previous => ({ ...previous, [field]: null }));
  };

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    const nextErrors = {};
    if (!form.role.trim()) nextErrors.role = 'Role is required.';
    if (!form.company.trim()) nextErrors.company = 'Company is required.';
    if (formRef.current.elements.url.validity.typeMismatch) nextErrors.url = 'Enter a valid URL.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      formRef.current.elements[Object.keys(nextErrors)[0]].focus();
      return;
    }
    const cleanedForm = {
      ...form,
      role: form.role.trim(),
      company: form.company.trim(),
      nextActionAt: fromLocalDateTimeInput(form.nextActionAt),
    };
    setSaving(true);
    const saved = await onSave(job.id, cleanedForm);
    setSaving(false);
    if (!saved) return;
    setForm({ ...cleanedForm, nextActionAt: toLocalDateTimeInput(cleanedForm.nextActionAt) });
    setMode('view');
  };

  const cancel = () => {
    setForm(toForm(job));
    setErrors({});
    setMode('view');
  };

  const fields = [
    ['Company', job.company],
    ['Date saved', formatDateTime(job.createdAt)],
    ['Stage', job.stage],
    ['Location', job.location],
    ['Salary', job.salary],
    ['Contact', job.contact],
    ['URL', job.url],
    ['Notes', job.notes],
  ];

  return (
    <dialog
      ref={panelRef}
      data-drawer
      closedby="any"
      aria-labelledby="job-panel-title"
      style={{ width: mobile ? '100%' : 420, maxWidth: '100vw', background: color.cardBg, height: '100dvh', padding: mobile ? '20px 18px 92px' : 28, flexDirection: 'column', gap: 18, borderLeft: `1px solid ${color.cardBorder}`, boxShadow: '-18px 0 44px rgba(24,56,67,0.16)', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div id="job-panel-title" style={{ font: `600 18px ${font.heading}`, lineHeight: 1.25 }}>{mode === 'edit' ? 'Edit job' : job.role}</div>
          <div style={{ fontSize: 13, color: color.textSecondary }}>{mode === 'edit' ? 'Update the details that keep this application moving.' : job.company}</div>
        </div>
        <button ref={closeButtonRef} type="button" aria-label="Close job details" onClick={() => panelRef.current.close()} style={{ border: 'none', borderRadius: radius.input, background: 'transparent', fontSize: 20, color: color.textMuted, cursor: 'pointer', width: 42, height: 42, flex: '0 0 auto' }}>×</button>
      </div>

      {mode === 'view' ? (
        <section aria-labelledby="job-next-action-title" style={{ paddingBottom: 18, borderBottom: `1px solid ${color.rowDivider}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 id="job-next-action-title" style={{ margin: 0, font: `600 12px ${font.body}`, color: color.textSecondary }}>Next action</h2>
            {job.urgent ? <span style={{ font: `600 11px ${font.body}`, color: color.urgent }}>Urgent</span> : null}
          </div>
          <div style={{ font: `600 17px ${font.heading}`, lineHeight: 1.4, color: job.next?.trim() ? color.ink : color.textMuted, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{job.next?.trim() || 'No next action set'}</div>
          <div title={formatDateTime(job.nextActionAt)} style={{ fontSize: 12, lineHeight: 1.5, color: color.textSecondary }}>{formatNextActionDue(job.nextActionAt)}</div>
        </section>
      ) : null}

      {mode === 'edit' ? (
        <form ref={formRef} id={formId} noValidate onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ padding: '9px 10px', borderRadius: radius.input, background: color.tideglass, color: color.textSecondary, font: `500 10px ${font.utility}` }}>Saved {formatDateTime(job.createdAt)}</div>
          <label style={labelStyle}><span id={`${formId}-role-label`}>Role</span>
            <input aria-labelledby={`${formId}-role-label`} name="role" required aria-invalid={Boolean(errors.role)} aria-describedby={errors.role ? `${formId}-role-error` : undefined} value={form.role} onChange={event => updateField('role', event.target.value)} style={{ ...inputStyle, borderColor: errors.role ? color.urgent : color.inputBorder }} />
            {errors.role ? <span id={`${formId}-role-error`} style={{ color: color.urgent, fontSize: 11, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>{errors.role}</span> : null}
          </label>
          <label style={labelStyle}><span id={`${formId}-company-label`}>Company</span>
            <input aria-labelledby={`${formId}-company-label`} name="company" required aria-invalid={Boolean(errors.company)} aria-describedby={errors.company ? `${formId}-company-error` : undefined} value={form.company} onChange={event => updateField('company', event.target.value)} style={{ ...inputStyle, borderColor: errors.company ? color.urgent : color.inputBorder }} />
            {errors.company ? <span id={`${formId}-company-error`} style={{ color: color.urgent, fontSize: 11, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>{errors.company}</span> : null}
          </label>
          <label style={labelStyle}>Stage
            <select value={form.stage} onChange={event => updateField('stage', event.target.value)} style={inputStyle}>{JOB_STAGES.map(stage => <option key={stage}>{stage}</option>)}</select>
          </label>
          <label style={labelStyle}>Location<input value={form.location} onChange={event => updateField('location', event.target.value)} style={inputStyle} /></label>
          <label style={labelStyle}>Salary<input value={form.salary} onChange={event => updateField('salary', event.target.value)} style={inputStyle} /></label>
          <label style={labelStyle}>Contact<input value={form.contact} onChange={event => updateField('contact', event.target.value)} style={inputStyle} /></label>
          <label style={labelStyle}>Next action<input value={form.next} onChange={event => updateField('next', event.target.value)} style={inputStyle} /></label>
          <label style={labelStyle}>Next action due<input type="datetime-local" value={form.nextActionAt} onChange={event => updateField('nextActionAt', event.target.value)} style={inputStyle} /></label>
          <label style={labelStyle}><span id={`${formId}-url-label`}>URL</span><input aria-labelledby={`${formId}-url-label`} name="url" type="url" aria-invalid={Boolean(errors.url)} aria-describedby={errors.url ? `${formId}-url-error` : undefined} value={form.url} onChange={event => updateField('url', event.target.value)} style={inputStyle} />
            {errors.url ? <span id={`${formId}-url-error`} style={{ color: color.urgent, fontSize: 11, textTransform: 'none' }}>{errors.url}</span> : null}
          </label>
          <label style={labelStyle}>Notes<textarea rows={4} value={form.notes} onChange={event => updateField('notes', event.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: color.textBodyMid, fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.urgent} onChange={event => updateField('urgent', event.target.checked)} style={{ accentColor: color.accent }} /> Mark next action as urgent
          </label>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: color.textMuted }}>{label}</div>
              <div style={{ fontSize: 13, color: color.textBodyMid, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {label === 'URL' && jobPostingUrl ? (
                  <a href={jobPostingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${job.role} job posting in a new tab`} style={{ color: color.accent, fontWeight: 600, textUnderlineOffset: 2 }}>{value} ↗</a>
                ) : value || '—'}
              </div>
            </div>
          ))}
          {mode === 'view' ? (
            <div style={{ marginTop: 6, paddingTop: 14, borderTop: `1px solid ${color.rowDivider}` }}>
              <JobEngagementPanel jobId={job.id} onChanged={onEngagementChanged} />
            </div>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${color.rowDivider}` }}>
        {mode === 'edit' ? (
          <>
            <ActionButton onClick={cancel} disabled={saving}>Cancel</ActionButton>
            <ActionButton type="submit" form={formId} disabled={saving} primary>{saving ? 'Saving…' : 'Save changes'}</ActionButton>
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
    </dialog>
  );
}
