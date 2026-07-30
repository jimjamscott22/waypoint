import { color, font, radius } from '../theme';

const METRICS = [
  { key: 'matchesFound', label: 'Matches found' },
  { key: 'savedListings', label: 'Saved listings' },
  { key: 'saveRate', label: 'Review save rate', suffix: '%' },
  { key: 'dismissedListings', label: 'Dismissed' },
];

function display(value, suffix = '') {
  return value == null ? '—' : `${value}${suffix}`;
}

export default function DiscoverySummary({ discovery, onOpenQuery }) {
  const queries = discovery?.queries ?? [];

  return (
    <section aria-labelledby="discovery-title" style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${color.rowDivider}` }}>
        <h2 id="discovery-title" style={{ margin: 0, font: `600 15px ${font.heading}`, color: color.ink }}>Discovery quality</h2>
        <div style={{ marginTop: 3, color: color.textMuted, fontSize: 11 }}>How often saved searches surface results worth keeping.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${color.rowDivider}` }}>
        {METRICS.map((metric, index) => (
          <div key={metric.key} style={{ padding: '13px 18px', borderRight: index === METRICS.length - 1 ? 'none' : `1px solid ${color.rowDivider}` }}>
            <div style={{ font: `600 18px ${font.heading}`, color: color.ink }}>{display(discovery?.[metric.key], metric.suffix)}</div>
            <div style={{ marginTop: 3, color: color.textMuted, fontSize: 10.5 }}>{metric.label}</div>
          </div>
        ))}
      </div>
      {queries.length === 0 ? (
        <div style={{ padding: '25px 18px', color: color.textSecondary, fontSize: 12 }}>No saved-query history exists in this range.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ color: color.textMuted, textAlign: 'right', fontSize: 9.5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                <th style={{ padding: '9px 18px', textAlign: 'left' }}>Query</th>
                <th style={{ padding: '9px 10px' }}>Matches</th>
                <th style={{ padding: '9px 10px' }}>Reviewed</th>
                <th style={{ padding: '9px 10px' }}>Saved</th>
                <th style={{ padding: '9px 10px' }}>Save rate</th>
                <th style={{ padding: '9px 18px 9px 10px' }}>Avg. score</th>
              </tr>
            </thead>
            <tbody>
              {queries.map(query => (
                <tr key={query.id} style={{ borderTop: `1px solid ${color.rowDivider}`, opacity: query.enabled ? 1 : 0.58, color: color.textBodyMid, textAlign: 'right' }}>
                  <td style={{ padding: '10px 18px', textAlign: 'left' }}>
                    <button type="button" onClick={() => onOpenQuery(query.id)} style={{ border: 'none', padding: 0, background: 'transparent', color: color.accent, font: `600 11.5px ${font.body}`, cursor: 'pointer' }}>
                      {query.name}
                    </button>
                    {!query.enabled ? <span style={{ marginLeft: 7, borderRadius: radius.pill, padding: '2px 6px', background: color.inputBg, color: color.textMuted, fontSize: 9 }}>Disabled</span> : null}
                  </td>
                  <td style={{ padding: '10px' }}>{query.matchesFound}</td>
                  <td style={{ padding: '10px' }}>{query.reviewedResults}</td>
                  <td style={{ padding: '10px' }}>{query.savedListings}</td>
                  <td style={{ padding: '10px' }}>{display(query.saveRate, '%')}</td>
                  <td style={{ padding: '10px 18px 10px 10px' }}>{display(query.averageScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
