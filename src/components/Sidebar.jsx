import { useState } from 'react';
import { color, font, radius } from '../theme';

const NAV_ITEMS = [
  { label: 'Pipeline', active: true },
  { label: 'Capture & queries', active: false },
  { label: 'Contacts', active: false },
  { label: 'Insights', active: false },
];

function NavItem({ label, active }) {
  const [hovered, setHovered] = useState(false);
  const bullet = active ? (
    <span style={{ width: 7, height: 7, borderRadius: 2, background: color.accent }} />
  ) : (
    <span style={{ width: 7, height: 7, borderRadius: '50%', border: `1.5px solid ${color.sidebarBulletOutline}` }} />
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: radius.input,
        fontSize: 13.5,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        color: active || hovered ? '#fff' : color.sidebarText,
        background: active ? 'rgba(255,255,255,0.09)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {bullet} {label}
    </div>
  );
}

export default function Sidebar() {
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
          <NavItem key={item.label} label={item.label} active={item.active} />
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
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>3 follow-ups due</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: color.sidebarMuted }}>
          Lakeview School District is the oldest — a short nudge keeps you on their radar.
        </div>
        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: color.accentLight, cursor: 'pointer' }}>
          Review follow-ups →
        </div>
      </div>
    </aside>
  );
}
