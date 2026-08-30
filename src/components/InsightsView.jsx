import { useEffect, useRef } from 'react';
import { color, font, radius } from '../theme';
import InsightsHeader from './InsightsHeader';
import OutcomeSummary from './OutcomeSummary';
import PipelineFunnel from './PipelineFunnel';
import WeeklyActivityChart from './WeeklyActivityChart';
import FocusNext from './FocusNext';
import DiscoverySummary from './DiscoverySummary';

function LoadingDashboard({ layoutMode }) {
  const mobile = layoutMode === 'mobile';
  return (
    <div aria-label="Loading Insights" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ height: 60, borderRadius: radius.card, background: color.cardBg, border: `1px solid ${color.cardBorder}` }} />
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
        {[0, 1, 2, 3].map(item => <div key={item} style={{ height: 104, borderRadius: radius.statCard, background: color.cardBg, border: `1px solid ${color.cardBorder}` }} />)}
      </div>
      <div style={{ height: 340, borderRadius: radius.card, background: color.cardBg, border: `1px solid ${color.cardBorder}` }} />
    </div>
  );
}

export default function InsightsView({
  data,
  loading,
  error,
  range,
  onChangeRange,
  onRetry,
  onOpenJob,
  onOpenQuery,
  layoutMode,
}) {
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (!data && loading) return <LoadingDashboard layoutMode={layoutMode} />;
  const mobile = layoutMode === 'mobile';

  if (!data && error) {
    return (
      <section aria-labelledby="insights-title" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <InsightsHeader range={range} onChangeRange={onChangeRange} headingRef={headingRef} layoutMode={layoutMode} />
        <div style={{ padding: 20, border: `1px solid #e7bbb7`, borderRadius: radius.card, background: '#fff7f6', color: color.urgent }}>
          <div style={{ font: `600 15px ${font.heading}` }}>Insights could not load</div>
          <div style={{ marginTop: 5, fontSize: 12.5 }}>{error.message}</div>
          <button type="button" onClick={onRetry} style={{ marginTop: 11, border: 'none', background: color.urgent, color: '#fff', borderRadius: radius.badge, padding: '7px 11px', font: `600 12px ${font.body}`, cursor: 'pointer' }}>Retry</button>
        </div>
      </section>
    );
  }

  const noActivity = data &&
    data.outcomes.applicationsSent === 0 &&
    data.outcomes.activeOpportunities === 0 &&
    data.discovery.matchesFound === 0;

  return (
    <section aria-labelledby="insights-title" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <InsightsHeader range={range} onChangeRange={onChangeRange} data={data} loading={loading} headingRef={headingRef} layoutMode={layoutMode} />
      {error ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 12px', border: `1px solid #e7bbb7`, borderRadius: radius.input, background: '#fff7f6', color: color.urgent, fontSize: 11.5 }}>
          <span>Refresh failed: {error.message}</span>
          <button type="button" onClick={onRetry} style={{ border: 'none', background: 'transparent', color: color.urgent, font: `700 11.5px ${font.body}`, cursor: 'pointer' }}>Try again</button>
        </div>
      ) : null}
      {noActivity ? (
        <div style={{ padding: '13px 16px', borderRadius: radius.input, border: `1px solid ${color.cardBorder}`, background: color.cardBg }}>
          <div style={{ font: `600 13px ${font.heading}`, color: color.ink }}>A clear starting point</div>
          <div style={{ marginTop: 3, fontSize: 11.5, color: color.textSecondary }}>No qualifying activity exists in this range yet. Waypoint will build this view as jobs and matches move.</div>
        </div>
      ) : null}
      <OutcomeSummary outcomes={data?.outcomes} layoutMode={layoutMode} />
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(210px, 0.8fr) minmax(0, 1.7fr)', gap: 12, alignItems: 'stretch' }}>
        <PipelineFunnel funnel={data?.funnel} />
        <WeeklyActivityChart rows={data?.weeklyActivity} />
      </div>
      <FocusNext recommendations={data?.recommendations} onOpenJob={onOpenJob} onOpenQuery={onOpenQuery} layoutMode={layoutMode} />
      <DiscoverySummary discovery={data?.discovery} onOpenQuery={onOpenQuery} layoutMode={layoutMode} />
    </section>
  );
}
