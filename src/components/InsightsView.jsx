import { useEffect, useRef } from 'react';
import { color, font, radius } from '../theme';

const RANGE_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

export default function InsightsView({ data, loading, error, range, onChangeRange, onRetry }) {
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="insights-title" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h1 ref={headingRef} tabIndex={-1} id="insights-title" style={{ margin: 0, font: `600 26px ${font.heading}`, outline: 'none' }}>Insights</h1>
          <p style={{ margin: '5px 0 0', color: color.textSecondary, fontSize: 13.5 }}>
            {loading && !data ? 'Loading your insights…' : error && !data ? error.message : 'Your job-search outcomes and discovery quality.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.input, padding: 4 }}>
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
      {error ? (
        <div style={{ padding: 16, border: `1px solid #e7bbb7`, borderRadius: radius.card, background: '#fff7f6', color: color.urgent }}>
          <div style={{ fontSize: 13 }}>{error.message}</div>
          <button type="button" onClick={onRetry} style={{ marginTop: 8, border: 'none', background: color.urgent, color: '#fff', borderRadius: radius.badge, padding: '7px 10px', font: `600 12px ${font.body}`, cursor: 'pointer' }}>Retry</button>
        </div>
      ) : (
        <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, background: color.cardBg, color: color.textMuted, fontSize: 13 }}>
          {loading ? 'Loading 90-day progress…' : 'Insights data is ready for the dashboard.'}
        </div>
      )}
    </section>
  );
}
