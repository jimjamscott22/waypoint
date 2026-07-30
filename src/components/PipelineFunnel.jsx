import { chipColor, color, font, radius } from '../theme';

export default function PipelineFunnel({ funnel }) {
  const applied = funnel?.find(item => item.stage === 'Applied')?.count ?? 0;

  return (
    <figure style={{ margin: 0, background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: 18, minWidth: 0 }}>
      <figcaption>
        <div style={{ font: `600 15px ${font.heading}`, color: color.ink }}>Application funnel</div>
        <div style={{ marginTop: 3, fontSize: 11, lineHeight: 1.4, color: color.textMuted }}>How this range’s application cohort progressed.</div>
      </figcaption>
      {applied === 0 ? (
        <div style={{ padding: '34px 6px 20px', textAlign: 'center', color: color.textSecondary, fontSize: 12, lineHeight: 1.5 }}>
          No recorded applications in this range yet.
        </div>
      ) : (
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 15 }}>
          {funnel.map(item => {
            const width = Math.max(8, (item.count / applied) * 100);
            const stageColor = chipColor[item.stage];
            return (
              <div key={item.stage}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: color.textBodyMid }}>{item.stage}</span>
                  <span style={{ font: `600 14px ${font.heading}`, color: stageColor.fg }}>{item.count}</span>
                </div>
                <div style={{ height: 9, borderRadius: radius.pill, background: color.rowDivider, overflow: 'hidden' }}>
                  <div aria-hidden="true" style={{ height: '100%', width: `${width}%`, borderRadius: radius.pill, background: stageColor.fg }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </figure>
  );
}
