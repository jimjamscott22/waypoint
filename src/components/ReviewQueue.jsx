import { color, font, radius } from '../theme';
import MatchCard from './MatchCard';

export default function ReviewQueue({ queue, onSave, onDismiss }) {
  return (
    <aside style={{ width: 296, flex: 'none', padding: '28px 24px 40px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ font: `600 15px ${font.heading}` }}>Scraper results</div>
        <div style={{ fontSize: 11.5, color: color.textMuted }}>ran 2h ago</div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: color.textSecondary, marginTop: -8 }}>
        3 new matches from your saved queries — keep the good ones, dismiss the rest.
      </div>

      {queue.map(match => (
        <MatchCard key={match.id} match={match} onSave={() => onSave(match.id)} onDismiss={() => onDismiss(match.id)} />
      ))}

      <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: 14, fontSize: 12, lineHeight: 1.55, color: color.textSecondary }}>
        <span style={{ fontWeight: 700, color: color.textBodyMid }}>Tip:</span> queries re-run every morning. Anything you dismiss trains the match score.
      </div>
    </aside>
  );
}
