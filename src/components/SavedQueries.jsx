import { useEffect, useRef, useState } from 'react';
import { describeQuery } from '../lib/queryForm';
import { color, font, radius } from '../theme';
import QueryEditor from './QueryEditor';

function QueryChip({ query, active, onEdit, onToggle, buttonRef }) {
  const summary = describeQuery(query);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${active ? color.accent : query.enabled ? color.inputBorder : color.dashedBorder}`, borderRadius: radius.pill, padding: '3px 8px 3px 11px', background: color.cardBg, opacity: query.enabled ? 1 : 0.6 }}>
      <button ref={buttonRef} type="button" onClick={onEdit} title={summary} aria-expanded={active} aria-label={`Edit ${query.name}${summary ? ` (${summary})` : ''}`} style={{ border: 'none', background: 'transparent', padding: 0, color: color.textBodyMid, font: `500 12px ${font.body}`, cursor: 'pointer' }}>{query.name}</button>
      <button type="button" aria-label={`${query.enabled ? 'Disable' : 'Enable'} ${query.name}`} onClick={onToggle} style={{ border: 'none', background: query.enabled ? color.accentSoft : color.inputBg, color: query.enabled ? color.accent : color.textMuted, borderRadius: radius.pill, padding: '1px 6px', fontSize: 10, cursor: 'pointer' }}>{query.enabled ? 'on' : 'off'}</button>
    </span>
  );
}

export default function SavedQueries({ queries, onCreate, onUpdate, onDelete, onResolveLocation, onPreview, focusQueryId, onFocusHandled, layoutMode }) {
  const [editing, setEditing] = useState(null);
  const queryButtons = useRef(new Map());
  const mobile = layoutMode === 'mobile';
  const editingQuery = editing && editing !== 'new' ? queries.find(query => query.id === editing) ?? null : null;

  useEffect(() => {
    if (!focusQueryId) return;
    const target = queryButtons.current.get(focusQueryId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
    onFocusHandled();
  }, [focusQueryId, onFocusHandled]);

  // A query deleted elsewhere closes its editor rather than leaving a detached form.
  useEffect(() => {
    if (editing && editing !== 'new' && !editingQuery) setEditing(null);
  }, [editing, editingQuery]);

  const toggleEditor = id => setEditing(previous => (previous === id ? null : id));
  const save = payload => (editing === 'new' ? onCreate(payload) : onUpdate(editing, payload));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Saved queries</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {queries.map(query => (
            <QueryChip
              key={query.id}
              query={query}
              active={editing === query.id}
              onEdit={() => toggleEditor(query.id)}
              onToggle={() => onUpdate(query.id, { enabled: !query.enabled })}
              buttonRef={node => {
                if (node) queryButtons.current.set(query.id, node);
                else queryButtons.current.delete(query.id);
              }}
            />
          ))}
          <button type="button" aria-expanded={editing === 'new'} onClick={() => toggleEditor('new')} style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.pill, padding: '4px 11px', font: `500 12px ${font.body}`, color: color.textMuted, background: color.cardBg, cursor: 'pointer' }}>+ New query</button>
        </div>
      </div>
      {editing === 'new' || editingQuery ? (
        <QueryEditor
          key={editing}
          query={editingQuery}
          layoutMode={layoutMode}
          onSave={save}
          onCancel={() => setEditing(null)}
          onDelete={onDelete}
          onResolveLocation={onResolveLocation}
          onPreview={onPreview}
        />
      ) : null}
    </div>
  );
}
