import { color, font, radius } from '../theme';
import MatchCard from './MatchCard';
import { FIT_FILTERS } from '../lib/matchFit';
import { DISTANCE_FILTERS, SORT_OPTIONS, WORK_TYPE_FILTERS } from '../lib/matchQueueFilters';

function relativeTime(timestamp) {
  if (!timestamp) return 'not run yet';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function FilterGroup({ label, options, activeId, counts, onChange, wide }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 4, padding: 3, borderRadius: radius.input, background: color.inputBg, border: `1px solid ${color.rowDivider}`, width: wide ? 'auto' : 'fit-content' }}>
      {options.map(option => {
        const active = activeId === option.id;
        return (
          <button key={option.id} type="button" aria-pressed={active} onClick={() => onChange(option.id)} style={{ flex: wide ? 1 : 'none', minHeight: 32, border: 'none', borderRadius: radius.badge, padding: '5px 10px', background: active ? color.cardBg : 'transparent', boxShadow: active ? '0 1px 3px rgba(24,56,67,0.12)' : 'none', color: active ? color.ink : color.textSecondary, font: `${active ? 650 : 500} 11px ${font.body}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {option.label} <span style={{ color: color.textMuted, font: `500 10px ${font.utility}` }}>{counts?.[option.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ReviewQueue({
  queue, totalQueueCount = queue.length,
  fitFilter = 'all', fitCounts, onChangeFitFilter,
  sortBy = 'score', onChangeSort,
  workTypeFilter = 'all', workTypeCounts, onChangeWorkTypeFilter,
  distanceFilter = 'all', distanceCounts, onChangeDistanceFilter,
  latestRun, provider, providerConfigured, running, onRun, onSave, onDismiss, layoutMode,
}) {
  const wide = layoutMode === 'wide';
  const mobile = layoutMode === 'mobile';
  const runHasErrors = latestRun?.status === 'failed' || latestRun?.status === 'partial';
  const status = latestRun ? `${latestRun.status} · ${latestRun.queriesSucceeded}/${latestRun.queriesTotal} searches · ${latestRun.newMatches} new · ${relativeTime(latestRun.finishedAt || latestRun.startedAt)}` : 'No completed searches yet';

  const content = (
    <>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: color.accent, font: `600 9.5px ${font.utility}`, letterSpacing: '1px', textTransform: 'uppercase' }}>Discovery review</div>
          <h1 id={!wide ? 'review-title' : undefined} style={{ margin: '5px 0 0', color: color.ink, font: `650 ${wide ? 20 : mobile ? 28 : 32}px ${font.heading}`, letterSpacing: '-0.5px' }}>New matches</h1>
          <div style={{ marginTop: 5, color: color.textSecondary, fontSize: 12.5, lineHeight: 1.45 }}>{providerConfigured ? `${totalQueueCount} match${totalQueueCount === 1 ? '' : 'es'} waiting for a decision.` : 'Configure the discovery provider to start reviewing matches.'}</div>
        </div>
        <button type="button" disabled={running || !providerConfigured} onClick={onRun} style={{ minHeight: 42, border: 'none', borderRadius: radius.input, background: running || !providerConfigured ? color.inputBorder : color.accent, color: color.onAccent, padding: '8px 13px', font: `600 11.5px ${font.body}`, cursor: running ? 'wait' : providerConfigured ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>{running ? 'Running…' : 'Run searches'}</button>
      </div>

      {totalQueueCount && onChangeSort ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: color.textSecondary, alignSelf: mobile ? 'stretch' : 'flex-start' }}>
          Sort by
          <select value={sortBy} onChange={event => onChangeSort(event.target.value)} style={{ flex: mobile ? 1 : 'none', border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.inputBg, color: color.ink, font: `600 11.5px ${font.body}`, padding: '6px 8px', minHeight: 32 }}>
            {SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      ) : null}

      <div role={runHasErrors ? 'alert' : 'status'} style={{ padding: '10px 11px', borderRadius: radius.input, background: runHasErrors ? color.urgentSoft : color.tideglass, color: runHasErrors ? color.urgent : color.textSecondary, font: `500 9.5px ${font.utility}`, lineHeight: 1.5 }}>
        {status}{runHasErrors && latestRun.errorSummary ? <div style={{ marginTop: 3 }}>{latestRun.errorSummary}</div> : null}
      </div>

      {totalQueueCount && onChangeFitFilter ? (
        <FilterGroup label="Filter matches by experience level" options={FIT_FILTERS} activeId={fitFilter} counts={fitCounts} onChange={onChangeFitFilter} wide={wide} />
      ) : null}
      {totalQueueCount && onChangeWorkTypeFilter ? (
        <FilterGroup label="Filter matches by work type" options={WORK_TYPE_FILTERS} activeId={workTypeFilter} counts={workTypeCounts} onChange={onChangeWorkTypeFilter} wide={wide} />
      ) : null}
      {totalQueueCount && onChangeDistanceFilter ? (
        <FilterGroup label="Filter matches by distance" options={DISTANCE_FILTERS} activeId={distanceFilter} counts={distanceCounts} onChange={onChangeDistanceFilter} wide={wide} />
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: !wide && !mobile ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 10 }}>
        {queue.map(match => <MatchCard key={match.id} match={match} onSave={() => onSave(match.id)} onDismiss={() => onDismiss(match.id)} />)}
      </div>
      {!queue.length && totalQueueCount ? <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: '22px 16px', textAlign: 'center' }}><div style={{ color: color.ink, font: `650 14px ${font.heading}` }}>No matches for these filters</div><div style={{ marginTop: 4, fontSize: 11.5, color: color.textMuted }}>{totalQueueCount} other match{totalQueueCount === 1 ? '' : 'es'} hidden by the current filters.</div><button type="button" onClick={() => { onChangeFitFilter?.('all'); onChangeWorkTypeFilter?.('all'); onChangeDistanceFilter?.('all'); }} style={{ marginTop: 8, border: 'none', background: 'transparent', color: color.accent, font: `600 11.5px ${font.body}`, cursor: 'pointer' }}>Clear filters</button></div> : null}
      {!totalQueueCount ? <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: '26px 16px', textAlign: 'center', background: color.emptyBg }}><div style={{ color: color.ink, font: `650 14px ${font.heading}` }}>Review route clear</div><div style={{ marginTop: 4, fontSize: 11.5, color: color.textMuted }}>New matches will appear here after a search run.</div></div> : null}

      <div style={{ borderTop: `1px solid ${color.cardBorder}`, paddingTop: 13, fontSize: 11.5, lineHeight: 1.55, color: color.textSecondary }}>Scores weigh title fit most, then description fit and distance, then posting recency and nice-to-have terms. Highlighted words are what matched. Dismissed jobs stay dismissed.</div>
      {provider ? <a href={provider.attributionUrl} target="_blank" rel="noreferrer" style={{ color: color.textMuted, font: `500 9.5px ${font.utility}`, textDecoration: 'none' }}>Jobs by {provider.name} ↗</a> : null}
    </>
  );

  if (wide) return <aside aria-label="Review matches" style={{ width: 318, flex: 'none', minHeight: '100vh', maxHeight: '100vh', position: 'sticky', top: 0, overflowY: 'auto', padding: '31px 18px 42px', display: 'flex', flexDirection: 'column', gap: 14, background: color.reviewBg, borderLeft: `1px solid ${color.cardBorder}` }}>{content}</aside>;

  return <section aria-labelledby="review-title" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{content}</section>;
}
