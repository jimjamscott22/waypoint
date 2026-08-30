import { chipColor, color, font, radius, shadow } from '../theme';

const MAIN_STAGES = ['Saved', 'Applied', 'Interviewing', 'Offer'];

function countFor(tabs, stage) {
  return tabs.find(tab => tab.stage === stage)?.count ?? 0;
}

function RouteNode({ stage, count, active, onSelect, mobile }) {
  const tone = chipColor[stage];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      style={{ position: 'relative', zIndex: 1, minWidth: mobile ? 92 : 0, minHeight: 66, border: `1px solid ${active ? tone.fg : color.cardBorder}`, borderRadius: radius.statCard, background: active ? tone.bg : color.cardBg, color: color.ink, padding: '10px 11px', textAlign: 'left', cursor: 'pointer', boxShadow: active ? shadow.card : 'none', transition: 'transform 140ms ease, border-color 140ms ease, background 140ms ease' }}
    >
      <span style={{ display: 'block', color: active ? tone.fg : color.textMuted, font: `600 9.5px ${font.utility}`, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{stage}</span>
      <span style={{ display: 'block', marginTop: 4, font: `650 21px ${font.heading}`, lineHeight: 1 }}>{count}</span>
      <span aria-hidden="true" style={{ position: 'absolute', left: 11, bottom: -5, width: 9, height: 9, borderRadius: '50%', background: active ? color.accent : tone.fg, border: `2px solid ${color.pageBg}` }} />
    </button>
  );
}

export default function PipelineRoute({ tabs, stageFilter, onSelectStage, layoutMode }) {
  const mobile = layoutMode === 'mobile';
  const total = countFor(tabs, 'All');
  const closed = countFor(tabs, 'Closed');

  return (
    <header style={{ animation: 'route-in 360ms ease-out both' }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ color: color.accent, font: `600 10px ${font.utility}`, letterSpacing: '1.25px', textTransform: 'uppercase' }}>Your search route</div>
          <h1 style={{ margin: '6px 0 0', maxWidth: 620, color: color.ink, font: `650 ${mobile ? 29 : 38}px ${font.heading}`, letterSpacing: '-1.15px', lineHeight: 1.02 }}>Where your search moves next.</h1>
          <p style={{ margin: '8px 0 0', color: color.textSecondary, fontSize: mobile ? 12.5 : 13.5, lineHeight: 1.5 }}>{total ? `${total} opportunities are mapped across your active pipeline.` : 'Capture your first opportunity to start mapping the route.'}</p>
        </div>
        <button type="button" aria-pressed={stageFilter === 'All'} onClick={() => onSelectStage('All')} style={{ alignSelf: mobile ? 'flex-start' : 'auto', minHeight: 40, border: `1px solid ${stageFilter === 'All' ? color.ink : color.inputBorder}`, borderRadius: radius.pill, background: stageFilter === 'All' ? color.ink : color.cardBg, color: stageFilter === 'All' ? '#fff' : color.textSecondary, padding: '8px 13px', font: `600 11px ${font.utility}`, cursor: 'pointer' }}>All jobs · {total}</button>
      </div>

      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: 'stretch', gap: mobile ? 5 : 9 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, overflowX: mobile ? 'auto' : 'visible', padding: '0 0 10px' }}>
          <div aria-hidden="true" style={{ position: 'absolute', left: 12, right: 12, bottom: 11, height: 2, background: color.inputBorder }} />
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(4, 92px)' : 'repeat(4, minmax(0, 1fr))', gap: 9, minWidth: mobile ? 395 : 0 }}>
            {MAIN_STAGES.map(stage => <RouteNode key={stage} stage={stage} count={countFor(tabs, stage)} active={stageFilter === stage} onSelect={() => onSelectStage(stage)} mobile={mobile} />)}
          </div>
        </div>
        <button type="button" aria-pressed={stageFilter === 'Closed'} onClick={() => onSelectStage('Closed')} style={{ width: mobile ? 92 : 82, flex: 'none', minHeight: mobile ? 48 : 66, alignSelf: mobile ? 'flex-end' : 'flex-start', border: `1px dashed ${stageFilter === 'Closed' ? chipColor.Closed.fg : color.dashedBorder}`, borderRadius: radius.statCard, background: stageFilter === 'Closed' ? chipColor.Closed.bg : 'transparent', color: stageFilter === 'Closed' ? color.ink : color.textMuted, padding: mobile ? '7px 9px' : '9px 7px', cursor: 'pointer' }}>
          <span style={{ display: 'block', font: `600 9px ${font.utility}`, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Closed</span>
          <span style={{ display: mobile ? 'inline' : 'block', margin: mobile ? '0 0 0 7px' : '4px 0 0', font: `650 18px ${font.heading}` }}>{closed}</span>
          <span style={{ display: 'block', marginTop: mobile ? 0 : 2, fontSize: 9 }}>off-ramp</span>
        </button>
      </div>
    </header>
  );
}
