import { color, font, radius } from '../theme';
import MatchCard from './MatchCard';

function relativeTime(timestamp) {
  if (!timestamp) return 'not run yet';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ReviewQueue({ queue, latestRun, provider, providerConfigured, running, onRun, onSave, onDismiss, layoutMode }) {
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
          <div style={{ marginTop: 5, color: color.textSecondary, fontSize: 12.5, lineHeight: 1.45 }}>{providerConfigured ? `${queue.length} match${queue.length === 1 ? '' : 'es'} waiting for a decision.` : 'Configure the discovery provider to start reviewing matches.'}</div>
        </div>
        <button type="button" disabled={running || !providerConfigured} onClick={onRun} style={{ minHeight: 42, border: 'none', borderRadius: radius.input, background: running || !providerConfigured ? color.inputBorder : color.accent, color: '#fff', padding: '8px 13px', font: `600 11.5px ${font.body}`, cursor: running ? 'wait' : providerConfigured ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>{running ? 'Running…' : 'Run searches'}</button>
      </div>

      <div role={runHasErrors ? 'alert' : 'status'} style={{ padding: '10px 11px', borderRadius: radius.input, background: runHasErrors ? '#fbefed' : color.tideglass, color: runHasErrors ? color.urgent : color.textSecondary, font: `500 9.5px ${font.utility}`, lineHeight: 1.5 }}>
        {status}{runHasErrors && latestRun.errorSummary ? <div style={{ marginTop: 3 }}>{latestRun.errorSummary}</div> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: !wide && !mobile ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 10 }}>
        {queue.map(match => <MatchCard key={match.id} match={match} onSave={() => onSave(match.id)} onDismiss={() => onDismiss(match.id)} />)}
      </div>
      {!queue.length ? <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: '26px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.5)' }}><div style={{ color: color.ink, font: `650 14px ${font.heading}` }}>Review route clear</div><div style={{ marginTop: 4, fontSize: 11.5, color: color.textMuted }}>New matches will appear here after a search run.</div></div> : null}

      <div style={{ borderTop: `1px solid ${color.cardBorder}`, paddingTop: 13, fontSize: 11.5, lineHeight: 1.55, color: color.textSecondary }}>Scores combine title fit, description fit, and posting recency. Dismissed jobs stay dismissed.</div>
      {provider ? <a href={provider.attributionUrl} target="_blank" rel="noreferrer" style={{ color: color.textMuted, font: `500 9.5px ${font.utility}`, textDecoration: 'none' }}>Jobs by {provider.name} ↗</a> : null}
    </>
  );

  if (wide) return <aside aria-label="Review matches" style={{ width: 318, flex: 'none', minHeight: '100vh', maxHeight: '100vh', position: 'sticky', top: 0, overflowY: 'auto', padding: '31px 18px 42px', display: 'flex', flexDirection: 'column', gap: 14, background: color.reviewBg, borderLeft: `1px solid ${color.cardBorder}` }}>{content}</aside>;

  return <section aria-labelledby="review-title" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{content}</section>;
}
