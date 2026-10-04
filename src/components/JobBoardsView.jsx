import { useEffect, useRef, useState } from 'react';
import { color, font, radius, shadow } from '../theme';
import { JOB_BOARDS, boardHost, buildBoardSearchUrl } from '../lib/jobBoards';

const fieldStyle = {
  border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.inputBg,
  padding: '9px 11px', font: `400 13px ${font.body}`, color: color.ink, minWidth: 0,
};

const linkButton = primary => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none', borderRadius: radius.smallButton,
  padding: '7px 11px', font: `600 12px ${font.body}`,
  background: primary ? color.accent : 'transparent',
  color: primary ? color.onAccent : color.textSecondary,
  border: primary ? 'none' : `1px solid ${color.inputBorder}`,
});

function BoardCard({ board, terms }) {
  const searchable = Boolean(board.search && terms.keywords.trim());
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: radius.card, background: color.cardBg, border: `1px solid ${color.cardBorder}`, boxShadow: shadow.card }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, font: `650 17px ${font.heading}`, color: color.ink }}>{board.name}</h2>
          <div style={{ marginTop: 2, color: color.textMuted, font: `500 10.5px ${font.utility}` }}>{boardHost(board)}</div>
        </div>
        <span style={{ flex: 'none', borderRadius: radius.pill, padding: '3px 9px', background: color.tideglass, color: color.ink, font: `600 10px ${font.utility}`, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{board.category}</span>
      </div>
      <p style={{ margin: 0, color: color.textBodyMid, fontSize: 13, lineHeight: 1.5 }}>{board.description}</p>
      <ul aria-label={`${board.name} is best for`} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: 0, padding: 0, listStyle: 'none' }}>
        {board.bestFor.map(tag => (
          <li key={tag} style={{ borderRadius: radius.badge, padding: '2px 7px', background: color.inputBg, border: `1px solid ${color.rowDivider}`, color: color.textSecondary, fontSize: 11 }}>{tag}</li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {searchable ? (
          <a href={buildBoardSearchUrl(board, terms)} target="_blank" rel="noopener noreferrer" style={linkButton(true)}>
            Search {board.name}<span aria-hidden="true">↗</span>
          </a>
        ) : null}
        <a href={board.url} target="_blank" rel="noopener noreferrer" style={linkButton(!searchable)}>
          Visit site<span aria-hidden="true">↗</span>
        </a>
        {board.note ? <span style={{ color: color.textMuted, fontSize: 11.5 }}>{board.note}</span> : null}
      </div>
    </article>
  );
}

export default function JobBoardsView({ queries, layoutMode }) {
  const mobile = layoutMode === 'mobile';
  const headingRef = useRef(null);
  const [terms, setTerms] = useState(() => {
    const seed = queries.find(query => query.enabled) ?? queries[0];
    return { keywords: seed?.keywords ?? '', location: seed?.location ?? '' };
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const setTerm = key => event => setTerms(previous => ({ ...previous, [key]: event.target.value }));

  return (
    <section aria-labelledby="boards-title" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ color: color.accent, font: `600 10px ${font.utility}`, letterSpacing: '1.1px', textTransform: 'uppercase' }}>Beyond Waypoint</div>
        <h1 ref={headingRef} tabIndex={-1} id="boards-title" style={{ margin: '5px 0 0', font: `650 ${mobile ? 29 : 36}px ${font.heading}`, letterSpacing: '-0.8px', outline: 'none' }}>
          Job boards
        </h1>
        <p style={{ margin: '5px 0 0', color: color.textSecondary, fontSize: 13.5 }}>
          Popular places to hunt for roles. Enter a search once and jump straight into each board’s results.
        </p>
      </div>

      <form role="search" aria-label="Search job boards" onSubmit={event => event.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: radius.card, background: color.reviewBg, border: `1px solid ${color.cardBorder}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 8 }}>
          <input aria-label="Search keywords" maxLength={120} placeholder="Keywords, e.g. junior developer" value={terms.keywords} onChange={setTerm('keywords')} style={fieldStyle} />
          <input aria-label="Search location" maxLength={120} placeholder="Location (optional)" value={terms.location} onChange={setTerm('location')} style={fieldStyle} />
        </div>
        {queries.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ color: color.textMuted, font: `500 10.5px ${font.utility}`, textTransform: 'uppercase', letterSpacing: '0.6px' }}>From saved queries</span>
            {queries.map(query => (
              <button
                key={query.id}
                type="button"
                onClick={() => setTerms({ keywords: query.keywords, location: query.location ?? '' })}
                style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.pill, padding: '3px 10px', background: color.cardBg, color: color.textBodyMid, font: `500 12px ${font.body}`, cursor: 'pointer' }}
              >
                {query.name}
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {JOB_BOARDS.map(board => <BoardCard key={board.id} board={board} terms={terms} />)}
      </div>
    </section>
  );
}
