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

export default function ReviewQueue({ queue, latestRun, provider, providerConfigured, running, onRun, onSave, onDismiss }) {
  const runHasErrors = latestRun?.status === 'failed' || latestRun?.status === 'partial';
  return (
    <aside style={{ width: 310, flex: 'none', padding: '28px 24px 40px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ font: `600 15px ${font.heading}` }}>Scraper results</div>
        <button type="button" disabled={running || !providerConfigured} onClick={onRun} style={{ border: 'none', borderRadius: radius.smallButton, background: running ? color.inputBorder : color.accent, color: '#fff', padding: '6px 9px', font: `600 11px ${font.body}`, cursor: running ? 'wait' : 'pointer' }}>{running ? 'Running…' : 'Run now'}</button>
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.45, color: runHasErrors ? color.urgent : color.textMuted }}>
        {latestRun ? `${latestRun.status} · ${latestRun.queriesSucceeded}/${latestRun.queriesTotal} queries · ${latestRun.listingsFetched} fetched · ${latestRun.newMatches} new · ${relativeTime(latestRun.finishedAt || latestRun.startedAt)}` : 'No completed runs'}
        {runHasErrors && latestRun.errorSummary ? <div role="alert" style={{ marginTop: 3 }}>{latestRun.errorSummary}</div> : null}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: color.textSecondary, marginTop: -8 }}>
        {providerConfigured ? `${queue.length} new match${queue.length === 1 ? '' : 'es'} from your saved queries.` : 'Add Adzuna credentials on the server to enable daily searches.'}
      </div>
      {queue.map(match => <MatchCard key={match.id} match={match} onSave={() => onSave(match.id)} onDismiss={() => onDismiss(match.id)} />)}
      {!queue.length ? <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: 16, textAlign: 'center', fontSize: 12, color: color.textMuted }}>Your review queue is clear.</div> : null}
      <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: 14, fontSize: 12, lineHeight: 1.55, color: color.textSecondary }}>
        Scores combine title keywords, description keywords, and posting recency. Dismissed jobs stay dismissed.
      </div>
      {provider ? <a href={provider.attributionUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: color.textMuted, textAlign: 'center' }}>Jobs by Adzuna</a> : null}
    </aside>
  );
}
