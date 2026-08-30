import { color, font, radius } from '../theme';

const DESKTOP_ITEMS = [
  { label: 'Pipeline', view: 'Pipeline', mark: '↗' },
  { label: 'Insights', view: 'Insights', mark: '∿' },
];

const COMPACT_ITEMS = [
  { label: 'Pipeline', view: 'Pipeline', mark: '↗' },
  { label: 'Review', view: 'Review', mark: '◎' },
  { label: 'Insights', view: 'Insights', mark: '∿' },
];

function Wordmark({ compact = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 9 }}>
      <div style={{ width: compact ? 30 : 34, height: compact ? 30 : 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: color.accent, color: '#fff', font: `700 ${compact ? 13 : 15}px ${font.heading}` }}>W</div>
      {!compact ? <div style={{ color: '#fff', font: `650 15px ${font.heading}`, letterSpacing: '0.2px' }}>Waypoint</div> : null}
    </div>
  );
}

function NavButton({ item, active, count, horizontal = false, onSelect }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(item.view)}
      style={{
        border: 'none', minHeight: 46, minWidth: horizontal ? 76 : 0,
        flex: horizontal ? 1 : 'none', width: horizontal ? 'auto' : '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        padding: horizontal ? '7px 9px' : '9px 5px', borderRadius: radius.input,
        background: active ? (horizontal ? color.tideglass : 'rgba(255,255,255,0.11)') : 'transparent',
        color: horizontal ? (active ? color.ink : color.textSecondary) : (active ? '#fff' : color.sidebarText),
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true" style={{ position: 'relative', font: `600 18px ${font.heading}`, lineHeight: 1 }}>
        {item.mark}
        {count ? <span style={{ position: 'absolute', top: -8, right: -13, minWidth: 16, height: 16, display: 'grid', placeItems: 'center', padding: '0 4px', borderRadius: radius.pill, background: color.accent, color: '#fff', font: `600 9px ${font.utility}` }}>{count}</span> : null}
      </span>
      <span style={{ font: `600 10.5px ${font.body}` }}>{item.label}</span>
    </button>
  );
}

export default function Sidebar({ activeView, onSelectView, layoutMode, reviewCount }) {
  if (layoutMode === 'mobile') {
    return (
      <>
        <header style={{ position: 'sticky', top: 0, zIndex: 12, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: color.sidebarBg, boxShadow: '0 6px 20px rgba(24,56,67,0.14)' }}>
          <Wordmark />
          <div style={{ color: color.sidebarMuted, font: `500 10px ${font.utility}`, letterSpacing: '0.7px', textTransform: 'uppercase' }}>Search cockpit</div>
        </header>
        <nav aria-label="Primary" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 18, minHeight: 70, display: 'flex', alignItems: 'center', padding: '6px 10px calc(6px + env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.96)', borderTop: `1px solid ${color.cardBorder}`, boxShadow: '0 -8px 28px rgba(24,56,67,0.10)', backdropFilter: 'blur(12px)' }}>
          {COMPACT_ITEMS.map(item => <NavButton key={item.view} item={item} horizontal active={activeView === item.view} count={item.view === 'Review' ? reviewCount : 0} onSelect={onSelectView} />)}
        </nav>
      </>
    );
  }

  const items = layoutMode === 'wide' ? DESKTOP_ITEMS : COMPACT_ITEMS;
  const highlightedView = layoutMode === 'wide' && activeView === 'Review' ? 'Pipeline' : activeView;
  return (
    <aside style={{ width: layoutMode === 'wide' ? 100 : 82, flex: 'none', minHeight: '100vh', position: 'sticky', top: 0, alignSelf: 'flex-start', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 10px', background: color.sidebarBg, color: color.sidebarText }}>
      <Wordmark compact />
      <nav aria-label="Primary" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5, marginTop: 34 }}>
        {items.map(item => <NavButton key={item.view} item={item} active={highlightedView === item.view} count={item.view === 'Review' ? reviewCount : 0} onSelect={onSelectView} />)}
      </nav>
      <div aria-hidden="true" style={{ marginTop: 'auto', width: 1, height: 64, background: 'linear-gradient(transparent, rgba(216,236,232,0.55))' }} />
      <div style={{ marginTop: 10, color: color.sidebarMuted, font: `500 9px ${font.utility}`, letterSpacing: '0.8px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textTransform: 'uppercase' }}>Keep moving</div>
    </aside>
  );
}
