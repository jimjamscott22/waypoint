import { useEffect, useRef, useState } from 'react';
import { color, font, radius } from '../theme';

const emptyQuery = { name: '', keywords: '', location: '', maxAgeDays: 7, enabled: true };
const fieldStyle = { border: `1px solid ${color.inputBorder}`, borderRadius: radius.badge, padding: '6px 8px', font: `400 12px ${font.body}`, color: color.ink, background: '#fff', width: '100%', minWidth: 0, minHeight: 40 };

function QueryChip({ query, onEdit, onToggle, buttonRef }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${query.enabled ? color.inputBorder : color.dashedBorder}`, borderRadius: radius.pill, padding: '3px 8px 3px 11px', background: '#fff', opacity: query.enabled ? 1 : 0.6 }}>
      <button ref={buttonRef} type="button" onClick={onEdit} style={{ border: 'none', background: 'transparent', padding: 0, color: color.textBodyMid, font: `500 12px ${font.body}`, cursor: 'pointer' }}>{query.name}</button>
      <button type="button" aria-label={`${query.enabled ? 'Disable' : 'Enable'} ${query.name}`} onClick={onToggle} style={{ border: 'none', background: query.enabled ? color.accentSoft : color.inputBg, color: query.enabled ? color.accent : color.textMuted, borderRadius: radius.pill, padding: '1px 6px', fontSize: 10, cursor: 'pointer' }}>{query.enabled ? 'on' : 'off'}</button>
    </span>
  );
}

export default function SavedQueries({ queries, onCreate, onUpdate, onDelete, focusQueryId, onFocusHandled, layoutMode }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyQuery);
  const queryButtons = useRef(new Map());
  const mobile = layoutMode === 'mobile';

  useEffect(() => {
    if (!focusQueryId) return;
    const target = queryButtons.current.get(focusQueryId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
    onFocusHandled();
  }, [focusQueryId, onFocusHandled]);

  const open = query => {
    setEditing(query?.id ?? 'new');
    setForm(query ? { name: query.name, keywords: query.keywords, location: query.location, maxAgeDays: query.maxAgeDays, enabled: query.enabled } : emptyQuery);
  };
  const submit = event => {
    event.preventDefault();
    const cleaned = { ...form, name: form.name.trim(), keywords: form.keywords.trim(), location: form.location.trim() };
    if (!cleaned.name || !cleaned.keywords) return;
    if (editing === 'new') onCreate(cleaned); else onUpdate(editing, cleaned);
    setEditing(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Saved queries</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {queries.map(query => (
            <QueryChip
              key={query.id}
              query={query}
              onEdit={() => open(query)}
              onToggle={() => onUpdate(query.id, { enabled: !query.enabled })}
              buttonRef={node => {
                if (node) queryButtons.current.set(query.id, node);
                else queryButtons.current.delete(query.id);
              }}
            />
          ))}
          <button type="button" onClick={() => open(null)} style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.pill, padding: '4px 11px', font: `500 12px ${font.body}`, color: color.textMuted, background: '#fff', cursor: 'pointer' }}>+ New query</button>
        </div>
      </div>
      {editing ? (
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : '1.1fr 1.5fr 1fr 90px auto', gap: 7, alignItems: 'center', paddingTop: 3 }}>
          <input aria-label="Query name" required maxLength={80} placeholder="Name" value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} style={{ ...fieldStyle, minWidth: 0, gridColumn: mobile ? '1 / -1' : 'auto' }} />
          <input aria-label="Query keywords" required maxLength={120} placeholder="Keywords" value={form.keywords} onChange={event => setForm(previous => ({ ...previous, keywords: event.target.value }))} style={{ ...fieldStyle, minWidth: 0, gridColumn: mobile ? '1 / -1' : 'auto' }} />
          <input aria-label="Query location" maxLength={120} placeholder="Location (optional)" value={form.location} onChange={event => setForm(previous => ({ ...previous, location: event.target.value }))} style={fieldStyle} />
          <select aria-label="Maximum age" value={form.maxAgeDays} onChange={event => setForm(previous => ({ ...previous, maxAgeDays: Number(event.target.value) }))} style={fieldStyle}>{[1, 3, 7, 14, 30].map(days => <option key={days} value={days}>{days} days</option>)}</select>
          <div style={{ display: 'flex', gap: 5, gridColumn: mobile ? '1 / -1' : 'auto' }}>
            <button type="submit" style={{ border: 'none', borderRadius: radius.badge, background: color.accent, color: '#fff', padding: '6px 11px', minHeight: 40, font: `600 11px ${font.body}`, cursor: 'pointer' }}>Save</button>
            <button type="button" onClick={() => setEditing(null)} style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.badge, background: '#fff', color: color.textMuted, padding: '6px 10px', minHeight: 40, cursor: 'pointer' }}>Cancel</button>
            {editing !== 'new' ? <button type="button" onClick={() => { onDelete(editing); setEditing(null); }} style={{ border: 'none', background: 'transparent', color: color.urgent, padding: '5px 10px', minHeight: 40, cursor: 'pointer' }}>Delete</button> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
