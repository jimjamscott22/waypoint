import { chipColor, color, font, radius } from '../theme';

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 20, right: 14, bottom: 34, left: 34 };
const SERIES = [
  { key: 'applied', label: 'Applied', color: chipColor.Applied.fg },
  { key: 'interviewing', label: 'Interviewing', color: chipColor.Interviewing.fg },
  { key: 'offer', label: 'Offer', color: chipColor.Offer.fg },
];

function shortDate(value) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
}

function linePath(rows, key, maximum) {
  if (!rows.length) return '';
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  return rows.map((row, index) => {
    const x = rows.length === 1 ? PAD.left + innerWidth / 2 : PAD.left + (index / (rows.length - 1)) * innerWidth;
    const y = PAD.top + innerHeight - (row[key] / maximum) * innerHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

export default function WeeklyActivityChart({ rows = [] }) {
  const maximum = Math.max(1, ...rows.flatMap(row => SERIES.map(series => row[series.key])));
  const labelStep = Math.max(1, Math.ceil(rows.length / 6));

  return (
    <figure style={{ margin: 0, background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: 18, minWidth: 0 }}>
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
        <div>
          <div style={{ font: `600 15px ${font.heading}`, color: color.ink }}>Weekly momentum</div>
          <div style={{ marginTop: 3, fontSize: 11, lineHeight: 1.4, color: color.textMuted }}>Recorded stage movement by UTC week.</div>
        </div>
        <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {SERIES.map(series => (
            <span key={series.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: color.textSecondary, fontSize: 10.5 }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: series.color }} />
              {series.label}
            </span>
          ))}
        </div>
      </figcaption>
      <svg role="img" aria-label="Weekly counts for applications, interviews, and offers" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block', width: '100%', height: 230, marginTop: 8, overflow: 'visible' }}>
        {[0, 0.5, 1].map(fraction => {
          const y = PAD.top + (1 - fraction) * (HEIGHT - PAD.top - PAD.bottom);
          return (
            <g key={fraction}>
              <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} stroke={color.rowDivider} strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill={color.textMuted}>{Math.round(maximum * fraction)}</text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          if (index % labelStep !== 0 && index !== rows.length - 1) return null;
          const innerWidth = WIDTH - PAD.left - PAD.right;
          const x = rows.length === 1 ? PAD.left + innerWidth / 2 : PAD.left + (index / (rows.length - 1)) * innerWidth;
          return <text key={row.weekStart} x={x} y={HEIGHT - 8} textAnchor="middle" fontSize="9.5" fill={color.textMuted}>{shortDate(row.weekStart)}</text>;
        })}
        {SERIES.map(series => (
          <path key={series.key} d={linePath(rows, series.key, maximum)} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <details style={{ marginTop: -4, borderTop: `1px solid ${color.rowDivider}`, paddingTop: 9 }}>
        <summary style={{ cursor: 'pointer', color: color.textSecondary, fontSize: 10.5, fontWeight: 600 }}>View exact weekly values</summary>
        <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
          {rows.map(row => (
            <div key={row.weekStart} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 72px)', gap: 8, padding: '4px 0', color: color.textSecondary, fontSize: 10.5 }}>
              <span>Week of {shortDate(row.weekStart)}</span>
              <span>Applied {row.applied}</span>
              <span>Interview {row.interviewing}</span>
              <span>Offer {row.offer}</span>
            </div>
          ))}
        </div>
      </details>
    </figure>
  );
}
