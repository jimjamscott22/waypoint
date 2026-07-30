import { useState } from 'react';
import { color, font, radius } from '../theme';

const NAV_ITEMS = [
  { label: 'Pipeline', view: 'Pipeline' },
  { label: 'Capture & queries', disabled: true },
  { label: 'Contacts', disabled: true },
  { label: 'Insights', view: 'Insights' },
];

function NavItem({ label, active, disabled, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const bullet = active ? (
    <span style={{ width: 7, height: 7, borderRadius: 2, background: color.accent }} />
  ) : (
    <span style={{ width: 7, height: 7, borderRadius: '50%', border: `1.5px solid ${color.sidebarBulletOutline}` }} />
  );

  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
      onMouseEnter={() => { if (!disabled) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        textAlign: 'left',
        gap: 10,
        padding: '9px 10px',
        borderRadius: radius.input,
        font: `${active ? 600 : 400} 13.5px ${font.body}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? color.sidebarMuted : active || hovered ? '#fff' : color.sidebarText,
        background: active ? 'rgba(255,255,255,0.09)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        opacity: disabled ? 0.56 : 1,
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {bullet} {label}
    </button>
  );
}

export default function Sidebar({ activeView, onSelectView }) {
  return (
    <aside
      style={{
        width: 224,
        flex: 'none',
        background: color.sidebarBg,
        color: color.sidebarText,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 22px' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.input,
            background: color.accent,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            font: `700 14px ${font.heading}`,
          }}
        >
          W
        </div>
        <div style={{ font: `600 16px ${font.heading}`, color: '#fff', letterSpacing: '0.2px' }}>Waypoint</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.label}
            label={item.label}
            active={item.view === activeView}
            disabled={item.disabled}
            onSelect={() => item.view && onSelectView(item.view)}
          />
        ))}
      </nav>

      <div
        style={{
          marginTop: 'auto',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: radius.statCard,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Your search, in context</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: color.sidebarMuted }}>
          See outcomes, momentum, and what deserves attention next.
        </div>
        <button
          type="button"
          onClick={() => onSelectView('Insights')}
          style={{ marginTop: 4, border: 'none', background: 'transparent', padding: 0, textAlign: 'left', font: `600 12px ${font.body}`, color: color.accentLight, cursor: 'pointer' }}
        >
          Open Insights →
        </button>
      </div>
    </aside>
  );
}
