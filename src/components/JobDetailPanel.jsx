import { color, font } from '../theme';

export default function JobDetailPanel({ job, onClose }) {
  const fields = [
    ['Company', job.company],
    ['Stage', job.stage],
    ['Location', job.location],
    ['Salary', job.salary],
    ['Contact', job.contact],
    ['Next action', job.next],
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,39,52,0.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 10 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 360,
          background: color.cardBg,
          height: '100%',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderLeft: `1px solid ${color.cardBorder}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ font: `600 18px ${font.heading}` }}>{job.role}</div>
            <div style={{ fontSize: 13, color: color.textSecondary }}>{job.company}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18, color: color.textMuted, cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: color.textMuted }}>
                {label}
              </div>
              <div style={{ fontSize: 13, color: color.textBodyMid }}>{value || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
