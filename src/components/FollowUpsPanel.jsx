import { formatDateTime } from '../lib/dateTime';
import { color, font, radius } from '../theme';

const STATUS_LABELS = {
  overdue: 'Overdue',
  today: 'Due today',
};

export default function FollowUpsPanel({ followUps = [], onOpenJob, layoutMode }) {
  if (!followUps.length) return null;
  const mobile = layoutMode === 'mobile';

  return (
    <section aria-labelledby="follow-ups-title" style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${color.rowDivider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <h2 id="follow-ups-title" style={{ margin: 0, font: `600 14px ${font.heading}`, color: color.ink }}>Follow up today</h2>
          <div style={{ marginTop: 3, color: color.textMuted, fontSize: 11 }}>Job next actions and outreach reminders that are due or overdue.</div>
        </div>
        <span style={{ flex: 'none', borderRadius: radius.pill, padding: '3px 8px', background: color.accentSoft, color: color.accent, font: `700 10px ${font.utility}` }}>{followUps.length}</span>
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {followUps.map((item, index) => (
          <li key={item.id} style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: mobile ? '11px 14px' : '11px 18px', borderBottom: index === followUps.length - 1 ? 'none' : `1px solid ${color.rowDivider}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: color.textBodyMid }}>{item.title}</span>
                <span style={{ borderRadius: radius.pill, padding: '2px 6px', background: item.status === 'overdue' ? '#fff0ee' : color.tideglass, color: item.status === 'overdue' ? color.urgent : color.accent, fontSize: 9.5, fontWeight: 700 }}>{STATUS_LABELS[item.status]}</span>
                <span style={{ borderRadius: radius.pill, padding: '2px 6px', background: color.inputBg, color: color.textMuted, fontSize: 9.5, fontWeight: 700 }}>{item.kind === 'outreach-follow-up' ? 'Outreach' : 'Next action'}</span>
              </div>
              <div style={{ marginTop: 3, color: color.textSecondary, fontSize: 10.5, lineHeight: 1.4 }}>{item.detail}</div>
              <div style={{ marginTop: 2, color: color.textMuted, fontSize: 10 }}>Due {formatDateTime(item.dueAt)}</div>
            </div>
            <button
              type="button"
              onClick={() => onOpenJob(item.jobId)}
              style={{ justifySelf: mobile ? 'start' : 'auto', border: `1px solid ${color.inputBorder}`, borderRadius: radius.smallButton, background: '#fff', color: color.accent, padding: '6px 9px', font: `600 10.5px ${font.body}`, cursor: 'pointer' }}
            >
              Open job
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
