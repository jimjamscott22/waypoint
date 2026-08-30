import { color, font, radius } from '../theme';

const RANGE_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const RANGE_COPY = {
  '30d': 'A focused look at the last 30 days.',
  '90d': 'Your outcomes and discovery quality over the last 90 days.',
  all: 'The complete history Waypoint can reliably measure.',
};

function formatCoverage(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export default function InsightsHeader({ range, onChangeRange, data, loading, headingRef, layoutMode }) {
  const coverageDate = formatCoverage(data?.historyCoverageStartsAt);
  const mobile = layoutMode === 'mobile';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <div style={{ color: color.accent, font: `600 10px ${font.utility}`, letterSpacing: '1.1px', textTransform: 'uppercase' }}>Search signals</div>
          <h1 ref={headingRef} tabIndex={-1} id="insights-title" style={{ margin: '5px 0 0', font: `650 ${mobile ? 29 : 36}px ${font.heading}`, letterSpacing: '-0.8px', outline: 'none' }}>
            Insights
          </h1>
          <p style={{ margin: '5px 0 0', color: color.textSecondary, fontSize: 13.5 }}>
            {RANGE_COPY[range]}{loading && data ? ' Refreshing…' : ''}
          </p>
        </div>
        <div role="group" aria-label="Insights reporting range" style={{ display: 'flex', alignSelf: mobile ? 'flex-start' : 'auto', gap: 4, background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.input, padding: 4 }}>
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={range === option.value}
              onClick={() => onChangeRange(option.value)}
              style={{
                border: 'none',
                borderRadius: radius.badge,
                background: range === option.value ? color.ink : 'transparent',
                color: range === option.value ? '#fff' : color.textSecondary,
                padding: '7px 11px',
                font: `600 12px ${font.body}`,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {data && !data.historyCompleteForRange && coverageDate ? (
        <div style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.inputBg, padding: '9px 12px', color: color.textSecondary, fontSize: 11.5, lineHeight: 1.45 }}>
          Stage history has been tracked since {coverageDate}. Earlier pipeline movement is not estimated.
        </div>
      ) : null}
    </div>
  );
}
