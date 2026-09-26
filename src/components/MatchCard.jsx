import { useMemo, useState } from 'react';
import { descriptionSnippet, explainMatch, highlightSegments } from '../lib/matchExplanation';
import { color, chipColor, font, radius } from '../theme';

const BAND_CHIP = { preferred: chipColor.Offer, expanded: chipColor.Interviewing, unknown: chipColor.Closed };
const SENIOR_CHIP = { bg: color.accentSoft, fg: color.urgent };
const FIT_BADGES = {
  entry: { label: 'Entry-level fit', chip: chipColor.Offer },
  stretch: { label: 'Stretch role', chip: chipColor.Interviewing },
  senior: { label: 'Likely senior', chip: SENIOR_CHIP },
  unknown: { label: 'Level not stated', chip: chipColor.Closed },
};
const REASON_CHIP = { positive: chipColor.Offer, caution: chipColor.Interviewing, negative: SENIOR_CHIP };

const chipStyle = { fontSize: 10.5, lineHeight: 1.3, borderRadius: radius.badge, padding: '2px 7px' };

function EvidenceRow({ label, terms, strong = false }) {
  if (!terms.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      <span style={{ color: color.textMuted, font: `600 9px ${font.utility}`, letterSpacing: '0.5px', textTransform: 'uppercase', minWidth: 42 }}>{label}</span>
      {terms.map(term => (
        <span key={term} style={{ ...chipStyle, color: strong ? color.accent : color.textBodyMid, background: strong ? color.accentSoft : color.inputBg, fontWeight: strong ? 600 : 500 }}>{term}</span>
      ))}
    </div>
  );
}

function LevelRow({ reasons }) {
  if (!reasons.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      <span style={{ color: color.textMuted, font: `600 9px ${font.utility}`, letterSpacing: '0.5px', textTransform: 'uppercase', minWidth: 42 }}>Level</span>
      {reasons.map(reason => {
        const chip = REASON_CHIP[reason.tone] ?? chipColor.Closed;
        return <span key={reason.text} style={{ ...chipStyle, color: chip.fg, background: chip.bg, fontWeight: 500 }}>{reason.text}</span>;
      })}
    </div>
  );
}

function Highlighted({ text, terms }) {
  return highlightSegments(text, terms).map((segment, index) => (segment.match
    ? <mark key={index} style={{ background: color.accentSoft, color: color.ink, borderRadius: 3, padding: '0 1px' }}>{segment.text}</mark>
    : <span key={index}>{segment.text}</span>));
}

export default function MatchCard({ match, onSave, onDismiss }) {
  const [saveHovered, setSaveHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const explanation = useMemo(() => explainMatch(match), [match]);
  const snippet = useMemo(() => descriptionSnippet(match.description), [match.description]);
  const fullDescription = useMemo(() => String(match.description ?? '').replace(/\s+/g, ' ').trim(), [match.description]);
  const band = explanation.distance ? BAND_CHIP[explanation.distance.band] ?? chipColor.Closed : null;
  const descriptionId = `match-description-${match.id}`;
  const fitBadge = match.fit ? FIT_BADGES[match.fit.fit] ?? FIT_BADGES.unknown : null;
  const levelReasons = match.fit?.reasons ?? [];

  return (
    <article aria-label={`${match.role} at ${match.company}`} style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 9, boxShadow: '0 8px 24px rgba(24,56,67,0.05)' }}>
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

      {fitBadge || band || explanation.workType.length ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {fitBadge ? <span title={levelReasons.length ? `Experience level: ${levelReasons.map(reason => reason.text).join(', ')}` : 'The listing does not state an experience level'} style={{ ...chipStyle, fontWeight: 600, color: fitBadge.chip.fg, background: fitBadge.chip.bg }}>{fitBadge.label}</span> : null}
          {band ? <span title="Distance from the nearest saved-query center" style={{ ...chipStyle, fontWeight: 600, color: band.fg, background: band.bg }}>{explanation.distance.label}</span> : null}
          {explanation.workType.map(label => <span key={label} style={{ ...chipStyle, color: color.textSecondary, background: color.inputBg }}>{label}</span>)}
        </div>
      ) : null}

      {explanation.hasEvidence || levelReasons.length ? (
        <section aria-label="Why it matched" style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 9px', borderRadius: radius.input, background: color.reviewBg }}>
          <EvidenceRow label="Title" terms={explanation.titleMatches.length ? explanation.titleMatches : explanation.roleFamilies} strong />
          <EvidenceRow label="Has" terms={explanation.requiredTerms} />
          <EvidenceRow label="Bonus" terms={explanation.optionalTerms} />
          <LevelRow reasons={levelReasons} />
        </section>
      ) : null}

      {snippet.text ? (
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: color.textBodyMid }}>
          <p id={descriptionId} style={{ margin: 0 }}>
            <Highlighted text={expanded ? fullDescription : snippet.text} terms={explanation.highlightTerms} />
          </p>
          {snippet.truncated ? (
            <button type="button" aria-expanded={expanded} aria-controls={descriptionId} onClick={() => setExpanded(previous => !previous)} style={{ border: 'none', background: 'transparent', padding: '3px 0 0', color: color.accent, font: `600 11px ${font.body}`, cursor: 'pointer' }}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {match.matchedQueries.map(query => <span key={query.id} title={`Score for ${query.name}`} style={{ fontSize: 10.5, color: color.textSecondary, background: color.inputBg, borderRadius: radius.badge, padding: '2px 6px' }}>{query.name} · {query.score}%</span>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <a href={match.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: color.accent, fontWeight: 600, textDecoration: 'none' }}>View listing ↗</a>
        {match.source ? <span style={{ color: color.textMuted, font: `500 9.5px ${font.utility}` }}>via {match.source}</span> : null}
      </div>
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
