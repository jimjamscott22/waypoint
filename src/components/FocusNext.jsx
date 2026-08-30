import { color, font, radius } from '../theme';

const TYPE_LABELS = {
  'follow-up-due': 'Due',
  'stalled-applied': 'Stalled',
  'stale-saved': 'Saved',
  'low-performing-query': 'Query',
};

function action(recommendation, onOpenJob, onOpenQuery) {
  if (recommendation.jobId) {
    onOpenJob({ jobId: recommendation.jobId, stage: recommendation.stage });
  } else if (recommendation.queryId) {
    onOpenQuery(recommendation.queryId);
  }
}

export default function FocusNext({ recommendations = [], onOpenJob, onOpenQuery, layoutMode }) {
  const visible = recommendations.slice(0, 8);
  const mobile = layoutMode === 'mobile';

  return (
    <section aria-labelledby="focus-next-title" style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 13px', borderBottom: `1px solid ${color.rowDivider}` }}>
        <h2 id="focus-next-title" style={{ margin: 0, font: `600 15px ${font.heading}`, color: color.ink }}>Focus next</h2>
        <div style={{ marginTop: 3, color: color.textMuted, fontSize: 11 }}>The clearest actions Waypoint can identify right now.</div>
      </div>
      {visible.length === 0 ? (
        <div style={{ padding: '28px 18px', color: color.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
          Nothing needs immediate attention. Keep your pipeline moving as new activity arrives.
        </div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {visible.map((recommendation, index) => (
            <li key={recommendation.id} style={{ display: 'grid', gridTemplateColumns: mobile ? '26px minmax(0, 1fr)' : '26px minmax(0, 1fr) auto', gap: 11, alignItems: 'center', padding: mobile ? '12px 13px' : '12px 18px', borderBottom: index === visible.length - 1 ? 'none' : `1px solid ${color.rowDivider}` }}>
              <span aria-hidden="true" style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: radius.badge, background: recommendation.type === 'follow-up-due' ? '#fff0ee' : color.accentSoft, color: recommendation.type === 'follow-up-due' ? color.urgent : color.accent, font: `700 10px ${font.body}` }}>
                {index + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: color.textBodyMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recommendation.title}</span>
                  <span style={{ flex: 'none', borderRadius: radius.pill, padding: '2px 6px', background: color.inputBg, color: color.textMuted, fontSize: 9.5, fontWeight: 700 }}>{TYPE_LABELS[recommendation.type]}</span>
                </div>
                <div style={{ marginTop: 3, color: color.textSecondary, fontSize: 10.5, lineHeight: 1.4 }}>{recommendation.detail}</div>
              </div>
              <button
                type="button"
                onClick={() => action(recommendation, onOpenJob, onOpenQuery)}
                aria-label={`${recommendation.actionLabel}: ${recommendation.title}`}
                style={{ gridColumn: mobile ? '2' : 'auto', minHeight: mobile ? 40 : 0, justifySelf: mobile ? 'start' : 'auto', border: `1px solid ${color.inputBorder}`, borderRadius: radius.smallButton, background: '#fff', color: color.accent, padding: '6px 9px', font: `600 10.5px ${font.body}`, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {recommendation.actionLabel}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
