import { useState } from 'react';
import { color, font, radius } from '../theme';

export default function MatchCard({ match, onSave, onDismiss }) {
  const [saveHovered, setSaveHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);

  return (
    <article style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 9, boxShadow: '0 8px 24px rgba(24,56,67,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ font: `650 13.5px ${font.heading}`, lineHeight: 1.3, color: color.ink }}>{match.role}</div>
          <div style={{ fontSize: 12, color: color.textSecondary }}>{match.company}</div>
        </div>
        <span style={{ flex: 'none', font: `600 9.5px ${font.utility}`, color: color.accent, background: color.accentSoft, borderRadius: radius.pill, padding: '4px 7px' }}>
          {match.score}% match
        </span>
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.45, color: color.textMuted }}>{[match.location, match.salary, `posted ${new Date(match.publishedAt).toLocaleDateString()}`].filter(Boolean).join(' · ')}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {match.matchedQueries.map(query => <span key={query.id} title={`Score for ${query.name}`} style={{ fontSize: 10.5, color: color.textSecondary, background: color.inputBg, borderRadius: radius.badge, padding: '2px 6px' }}>{query.name} · {query.score}%</span>)}
      </div>
      <a href={match.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: color.accent, fontWeight: 600, textDecoration: 'none' }}>View listing ↗</a>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          onClick={onSave}
          onMouseEnter={() => setSaveHovered(true)}
          onMouseLeave={() => setSaveHovered(false)}
          style={{
            flex: 1,
            border: `1px solid ${color.accent}`,
            background: saveHovered ? color.accentSoft : '#fff',
            color: color.accent,
            borderRadius: radius.smallButton,
            minHeight: 40,
            padding: '7px 8px',
            font: `600 12px ${font.body}`,
            cursor: 'pointer',
            transition: 'background 120ms ease',
          }}
        >
          Save to pipeline
        </button>
        <button
          onClick={onDismiss}
          onMouseEnter={() => setDismissHovered(true)}
          onMouseLeave={() => setDismissHovered(false)}
          style={{
            flex: 'none',
            border: `1px solid ${color.inputBorder}`,
            background: '#fff',
            color: dismissHovered ? color.textSecondary : color.textMuted,
            borderRadius: radius.smallButton,
            minHeight: 40,
            padding: '7px 12px',
            font: `500 12px ${font.body}`,
            cursor: 'pointer',
            transition: 'color 120ms ease',
          }}
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}
