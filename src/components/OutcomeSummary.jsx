import { color, font, radius } from '../theme';

const METRICS = [
  { key: 'applicationsSent', label: 'Applications sent', note: 'Entered Applied in this range' },
  { key: 'interviewsReached', label: 'Interviews reached', note: 'Application cohort progressing' },
  { key: 'interviewRate', label: 'Application-to-interview', note: 'Cohort conversion rate', suffix: '%' },
  { key: 'activeOpportunities', label: 'Active opportunities', note: 'Applied, interviewing, or offer' },
];

export default function OutcomeSummary({ outcomes, layoutMode }) {
  const mobile = layoutMode === 'mobile';
  return (
    <section aria-label="Outcome summary" style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
      {METRICS.map(metric => {
        const value = outcomes?.[metric.key];
        return (
            <div key={metric.key} style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.statCard, padding: mobile ? '13px 12px' : '15px 16px 14px', minWidth: 0 }}>
            <div style={{ font: `600 23px ${font.heading}`, color: color.ink, letterSpacing: '-0.2px' }}>
              {value == null ? '—' : `${value}${metric.suffix ?? ''}`}
            </div>
            <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: color.textBodyMid }}>{metric.label}</div>
            <div style={{ marginTop: 3, fontSize: 10.5, color: color.textMuted, lineHeight: 1.35 }}>{metric.note}</div>
          </div>
        );
      })}
    </section>
  );
}
