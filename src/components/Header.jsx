import { color, font, radius } from '../theme';

const STATS = [
  { value: '4', label: 'applied this week' },
  { value: '2', label: 'interviews booked' },
  { value: '38%', label: 'response rate' },
];

export default function Header() {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ font: `600 26px ${font.heading}`, letterSpacing: '-0.2px' }}>Good morning</div>
        <div style={{ fontSize: 13.5, color: color.textSecondary }}>
          2 interviews on the calendar this week — momentum is on your side.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {STATS.map(stat => (
          <div
            key={stat.label}
            style={{
              background: color.cardBg,
              border: `1px solid ${color.cardBorder}`,
              borderRadius: radius.statCard,
              padding: '10px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <div style={{ font: `600 18px ${font.heading}` }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 500 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </header>
  );
}
