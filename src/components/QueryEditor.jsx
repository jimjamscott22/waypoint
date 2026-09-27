import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_AGE_OPTIONS,
  MAX_RADIUS_MILES,
  ROLE_FAMILY_OPTIONS,
  applyLocationCandidate,
  canPreview,
  formToPayload,
  locationStatus,
  queryToForm,
  summarizePreview,
  validateQueryForm,
} from '../lib/queryForm';
import { color, chipColor, font, radius } from '../theme';

const fieldStyle = {
  border: `1px solid ${color.inputBorder}`,
  borderRadius: radius.badge,
  padding: '7px 9px',
  minHeight: 38,
  font: `400 12.5px ${font.body}`,
  color: color.ink,
  background: color.cardBg,
  width: '100%',
  minWidth: 0,
  outlineColor: color.accent,
};

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 5, color: color.textSecondary, font: `600 11px ${font.body}` };

function buttonStyle(kind = 'secondary', disabled = false) {
  const base = { minHeight: 38, borderRadius: radius.badge, padding: '6px 12px', font: `600 11.5px ${font.body}`, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.55 : 1 };
  if (kind === 'primary') return { ...base, border: 'none', background: color.accent, color: color.cardBg };
  if (kind === 'danger') return { ...base, border: 'none', background: 'transparent', color: color.urgent };
  return { ...base, border: `1px solid ${color.inputBorder}`, background: color.cardBg, color: color.textBodyMid };
}

function FieldError({ id, message }) {
  if (!message) return null;
  return <span id={id} role="alert" style={{ color: color.urgent, font: `500 11px ${font.body}` }}>{message}</span>;
}

function Section({ title, hint, children, wide }) {
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9, gridColumn: wide ? '1 / -1' : 'auto' }}>
      <legend style={{ padding: 0, marginBottom: 2 }}>
        <span style={{ color: color.ink, font: `650 13px ${font.heading}` }}>{title}</span>
        {hint ? <span style={{ display: 'block', marginTop: 2, color: color.textMuted, font: `400 11px ${font.body}` }}>{hint}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

// Shows the two radius bands to scale: listings inside the preferred ring score higher,
// listings between the rings still match, and anything farther is filtered out.
function RadiusBar({ preferred, maximum }) {
  const p = Math.min(Math.max(Number(preferred) || 0, 0), MAX_RADIUS_MILES);
  const m = Math.min(Math.max(Number(maximum) || 0, 0), MAX_RADIUS_MILES);
  const toPercent = miles => `${(miles / MAX_RADIUS_MILES) * 100}%`;
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: radius.pill, background: color.inputBg, border: `1px solid ${color.rowDivider}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: toPercent(Math.max(m, p)), background: color.accentSoft }} />
        <div style={{ position: 'absolute', inset: 0, width: toPercent(Math.min(p, m || p)), background: color.accentLight }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: color.textMuted, font: `500 9.5px ${font.utility}` }}>
        <span>0 mi</span><span>preferred ≤ {p || '—'} · expanded ≤ {m || '—'}</span><span>{MAX_RADIUS_MILES} mi</span>
      </div>
    </div>
  );
}

function LocationBadge({ status, displayName }) {
  if (status === 'pinned') {
    return <span style={{ alignSelf: 'flex-start', borderRadius: radius.pill, padding: '3px 9px', background: chipColor.Offer.bg, color: chipColor.Offer.fg, font: `600 10.5px ${font.body}` }}>Pinned: {displayName}</span>;
  }
  if (status === 'unpinned') {
    return <span style={{ color: color.textMuted, font: `400 11px ${font.body}` }}>Not pinned to a map point, so distance filters can’t apply. Look it up to pin it.</span>;
  }
  return null;
}

function formatMiles(miles) {
  return miles == null ? 'distance unknown' : `${Math.round(miles)} mi`;
}

const STATUS_NOTES = { new: 'in review', saved: 'saved', dismissed: 'dismissed', expired: 'expired' };

function PreviewPanel({ preview, stale }) {
  if (preview.status === 'idle') return null;
  if (preview.status === 'loading') {
    return <div role="status" style={{ color: color.textSecondary, font: `500 11.5px ${font.body}` }}>Searching a sample of live listings…</div>;
  }
  if (preview.status === 'error') {
    return <div role="alert" style={{ color: color.urgent, font: `500 11.5px ${font.body}` }}>{preview.message}</div>;
  }

  const summary = summarizePreview(preview.result.diagnostics);
  const results = preview.result.results ?? [];
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: radius.input, background: color.reviewBg, border: `1px solid ${color.rowDivider}`, opacity: stale ? 0.6 : 1 }}>
      <div style={{ color: color.ink, font: `650 13px ${font.heading}` }}>
        {summary.newMatches} new {summary.newMatches === 1 ? 'match' : 'matches'} from {summary.scanned} listings scanned
        {stale ? <span style={{ marginLeft: 8, color: color.textMuted, font: `500 10.5px ${font.body}` }}>Criteria changed, so preview again</span> : null}
      </div>
      {summary.known.length ? (
        <div style={{ color: color.textSecondary, fontSize: 11.5 }}>{summary.known.map(item => `${item.count} ${item.label}`).join(' · ')}</div>
      ) : null}
      {summary.filteredOut.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <span style={{ color: color.textMuted, font: `600 9.5px ${font.utility}`, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Filtered out</span>
          {summary.filteredOut.map(item => (
            <span key={item.label} style={{ borderRadius: radius.pill, padding: '2px 8px', background: color.cardBg, color: color.textBodyMid, fontSize: 11 }}>{item.count} {item.label}</span>
          ))}
        </div>
      ) : null}
      {summary.truncated ? <div style={{ color: color.textMuted, fontSize: 11 }}>Preview stops after a small sample, so a full run may find more.</div> : null}
      {results.length ? (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map(result => (
            <li key={result.url} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: radius.badge, background: color.cardBg }}>
              <div style={{ minWidth: 0 }}>
                <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: color.accent, font: `600 12px ${font.body}`, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.title} ↗</a>
                <div style={{ color: color.textSecondary, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[result.company, formatMiles(result.distanceMiles), result.status ? STATUS_NOTES[result.status] : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{ flex: 'none', alignSelf: 'center', borderRadius: radius.pill, padding: '3px 7px', background: color.accentSoft, color: color.accent, font: `600 9.5px ${font.utility}` }}>{Math.round(result.score)}%</span>
            </li>
          ))}
        </ol>
      ) : (
        <div style={{ color: color.textSecondary, fontSize: 11.5 }}>No listings passed every filter. Try a wider radius, more role families, or fewer required terms.</div>
      )}
    </div>
  );
}

export default function QueryEditor({ query, layoutMode, onSave, onCancel, onDelete, onResolveLocation, onPreview }) {
  const [form, setForm] = useState(() => queryToForm(query));
  const [showErrors, setShowErrors] = useState(false);
  const [lookup, setLookup] = useState({ status: 'idle', candidates: [], message: '' });
  const [preview, setPreview] = useState({ status: 'idle' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef(null);
  const mobile = layoutMode === 'mobile';
  const isNew = !query;

  useEffect(() => { nameRef.current?.focus(); }, []);

  const errors = useMemo(() => validateQueryForm(form), [form]);
  const visibleErrors = showErrors ? errors : {};
  const status = locationStatus(form);
  const payloadKey = useMemo(() => JSON.stringify(formToPayload(form)), [form]);
  const previewStale = preview.status === 'ready' && preview.payloadKey !== payloadKey;

  const update = (field, value) => setForm(previous => ({ ...previous, [field]: value }));

  const lookUpLocation = async () => {
    const text = form.locationText.trim();
    if (!text) return;
    setLookup({ status: 'loading', candidates: [], message: '' });
    try {
      const candidates = await onResolveLocation(text);
      setLookup(candidates.length
        ? { status: 'ready', candidates, message: '' }
        : { status: 'error', candidates: [], message: 'No US places matched. Try "City, ST".' });
    } catch (error) {
      setLookup({ status: 'error', candidates: [], message: error.message });
    }
  };

  const chooseCandidate = candidate => {
    setForm(previous => applyLocationCandidate(previous, candidate));
    setLookup({ status: 'idle', candidates: [], message: '' });
  };

  const toggleFamily = id => setForm(previous => ({
    ...previous,
    roleFamilies: previous.roleFamilies.includes(id)
      ? previous.roleFamilies.filter(family => family !== id)
      : [...previous.roleFamilies, id],
  }));

  const runPreview = async () => {
    const key = payloadKey;
    setPreview({ status: 'loading' });
    try {
      const result = await onPreview(formToPayload(form));
      setPreview({ status: 'ready', result, payloadKey: key });
    } catch (error) {
      setPreview({ status: 'error', message: error.message });
    }
  };

  const submit = async event => {
    event.preventDefault();
    if (Object.keys(errors).length) { setShowErrors(true); return; }
    setSaving(true);
    const saved = await onSave(formToPayload(form));
    setSaving(false);
    if (saved) onCancel();
  };

  const describedBy = field => (visibleErrors[field] ? `query-${field}-error` : undefined);
  const previewReady = canPreview(form);

  return (
    <form onSubmit={submit} noValidate aria-label={isNew ? 'New saved query' : `Edit ${query.name}`} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4, padding: mobile ? 12 : 16, border: `1px solid ${color.cardBorder}`, borderRadius: radius.input, background: color.inputBg }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 10, alignItems: mobile ? 'stretch' : 'flex-end' }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          Query name
          <input ref={nameRef} maxLength={80} placeholder="e.g. Syracuse help desk" value={form.name} onChange={event => update('name', event.target.value)} aria-invalid={Boolean(visibleErrors.name)} aria-describedby={describedBy('name')} style={fieldStyle} />
          <FieldError id="query-name-error" message={visibleErrors.name} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 38, color: color.textBodyMid, font: `500 12px ${font.body}`, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.enabled} onChange={event => update('enabled', event.target.checked)} style={{ accentColor: color.accent, width: 16, height: 16 }} />
          Include in daily runs
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: mobile ? 18 : '18px 24px' }}>
        <Section title="Where" hint="Search around one place. Closer listings score higher.">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              aria-label="Search location"
              placeholder="City, ST"
              value={form.locationText}
              onChange={event => update('locationText', event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); lookUpLocation(); } }}
              aria-invalid={Boolean(visibleErrors.location)}
              aria-describedby={describedBy('location')}
              style={fieldStyle}
            />
            <button type="button" onClick={lookUpLocation} disabled={!form.locationText.trim() || lookup.status === 'loading'} style={buttonStyle('secondary', !form.locationText.trim() || lookup.status === 'loading')}>
              {lookup.status === 'loading' ? 'Looking…' : 'Look up'}
            </button>
          </div>
          {lookup.status === 'ready' ? (
            <div role="group" aria-label="Matching places" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lookup.candidates.map(candidate => (
                <button key={`${candidate.placeId}-${candidate.latitude}`} type="button" onClick={() => chooseCandidate(candidate)} style={{ textAlign: 'left', border: `1px solid ${color.rowDivider}`, borderRadius: radius.badge, background: color.cardBg, color: color.textBodyMid, padding: '7px 9px', font: `400 12px ${font.body}`, cursor: 'pointer' }}>
                  {candidate.displayName}
                </button>
              ))}
            </div>
          ) : null}
          {lookup.status === 'error' ? <span role="alert" style={{ color: color.urgent, fontSize: 11 }}>{lookup.message}</span> : null}
          <FieldError id="query-location-error" message={visibleErrors.location} />
          <LocationBadge status={status} displayName={form.center.displayName} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={labelStyle}>
              Preferred radius (mi)
              <input type="number" inputMode="numeric" min={1} max={MAX_RADIUS_MILES} step={1} value={form.preferredRadiusMiles} onChange={event => update('preferredRadiusMiles', event.target.value)} aria-invalid={Boolean(visibleErrors.preferredRadiusMiles)} aria-describedby={describedBy('preferredRadiusMiles')} style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              Maximum radius (mi)
              <input type="number" inputMode="numeric" min={1} max={MAX_RADIUS_MILES} step={1} value={form.maximumRadiusMiles} onChange={event => update('maximumRadiusMiles', event.target.value)} aria-invalid={Boolean(visibleErrors.maximumRadiusMiles)} aria-describedby={describedBy('maximumRadiusMiles')} style={fieldStyle} />
            </label>
          </div>
          <FieldError id="query-preferredRadiusMiles-error" message={visibleErrors.preferredRadiusMiles} />
          <FieldError id="query-maximumRadiusMiles-error" message={visibleErrors.maximumRadiusMiles} />
          <RadiusBar preferred={form.preferredRadiusMiles} maximum={form.maximumRadiusMiles} />
        </Section>

        <Section title="What" hint="A listing's title must match one of these families. Hover one to see the titles it covers.">
          <div role="group" aria-label="Role families" aria-describedby={describedBy('roleFamilies')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ROLE_FAMILY_OPTIONS.map(option => {
              const selected = form.roleFamilies.includes(option.id);
              return (
                <button key={option.id} type="button" aria-pressed={selected} title={option.synonyms.join(', ')} onClick={() => toggleFamily(option.id)} style={{ border: `1px solid ${selected ? color.accent : color.inputBorder}`, borderRadius: radius.pill, padding: '5px 11px', minHeight: 32, background: selected ? color.accentSoft : color.cardBg, color: selected ? color.accent : color.textBodyMid, font: `${selected ? 600 : 500} 11.5px ${font.body}`, cursor: 'pointer' }}>
                  {selected ? '✓ ' : ''}{option.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => update('roleFamilies', ROLE_FAMILY_OPTIONS.map(option => option.id))} style={{ border: 'none', background: 'transparent', padding: 0, color: color.accent, font: `500 11px ${font.body}`, cursor: 'pointer' }}>Select all</button>
            <button type="button" onClick={() => update('roleFamilies', [])} style={{ border: 'none', background: 'transparent', padding: 0, color: color.textMuted, font: `500 11px ${font.body}`, cursor: 'pointer' }}>Clear</button>
          </div>
          <FieldError id="query-roleFamilies-error" message={visibleErrors.roleFamilies} />
        </Section>

        <Section title="Terms" hint="Separate terms with commas. Terms are matched against the title and description.">
          {[
            ['requiredTerms', 'Must include', 'e.g. Active Directory'],
            ['optionalTerms', 'Nice to have (raises score)', 'e.g. Windows, Office 365, CompTIA'],
            ['excludedTerms', 'Exclude', 'e.g. senior, clearance, commission'],
          ].map(([field, label, placeholder]) => (
            <label key={field} style={labelStyle}>
              {label}
              <input placeholder={placeholder} value={form[field]} onChange={event => update(field, event.target.value)} aria-invalid={Boolean(visibleErrors[field])} aria-describedby={describedBy(field)} style={fieldStyle} />
              <FieldError id={`query-${field}-error`} message={visibleErrors[field]} />
            </label>
          ))}
        </Section>

        <Section title="Filters" hint="Listings with no posted salary are kept, since many employers leave it out.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={labelStyle}>
              Posted within
              <select value={form.maxAgeDays} onChange={event => update('maxAgeDays', Number(event.target.value))} style={fieldStyle}>
                {MAX_AGE_OPTIONS.map(days => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Minimum salary (yearly)
              <input inputMode="decimal" placeholder="Any" value={form.minimumSalary} onChange={event => update('minimumSalary', event.target.value)} aria-invalid={Boolean(visibleErrors.minimumSalary)} aria-describedby={describedBy('minimumSalary')} style={fieldStyle} />
            </label>
          </div>
          <FieldError id="query-minimumSalary-error" message={visibleErrors.minimumSalary} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 38, color: color.textBodyMid, font: `500 12px ${font.body}`, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.excludeSeniorRoles} onChange={event => update('excludeSeniorRoles', event.target.checked)} style={{ accentColor: color.accent, width: 16, height: 16 }} />
            Exclude senior roles
          </label>
          <span style={{ color: color.textMuted, font: `400 11px ${font.body}` }}>Filters out listings whose title reads senior, lead, principal, manager, or similar, or that ask for 5+ years of experience.</span>
        </Section>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: `1px solid ${color.rowDivider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={runPreview} disabled={!previewReady || preview.status === 'loading'} style={buttonStyle('secondary', !previewReady || preview.status === 'loading')}>
            {preview.status === 'loading' ? 'Previewing…' : previewStale ? 'Preview again' : 'Preview matches'}
          </button>
          <span style={{ color: color.textMuted, fontSize: 11 }}>
            {previewReady ? 'Sample live listings without saving anything.' : 'Pin a location and fill the required fields to preview.'}
          </span>
        </div>
        <PreviewPanel preview={preview} stale={previewStale} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="submit" disabled={saving} style={buttonStyle('primary', saving)}>{saving ? 'Saving…' : isNew ? 'Create query' : 'Save changes'}</button>
        <button type="button" onClick={onCancel} style={buttonStyle()}>Cancel</button>
        {showErrors && Object.keys(errors).length ? <span role="alert" style={{ color: color.urgent, fontSize: 11.5 }}>Fix the highlighted fields to save.</span> : null}
        {!isNew ? (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {confirmDelete ? (
              <>
                <span style={{ color: color.textSecondary, fontSize: 11.5 }}>Delete this query and its unreviewed matches?</span>
                <button type="button" onClick={() => { onDelete(query.id); onCancel(); }} style={{ ...buttonStyle('primary'), background: color.urgent }}>Delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} style={buttonStyle()}>Keep</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} style={buttonStyle('danger')}>Delete query</button>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
