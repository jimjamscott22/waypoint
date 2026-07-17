const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

export function normalizeTokens(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !STOP_WORDS.has(token))
    .map(token => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token)
    .map(token => {
      if (token.length > 8 && token.endsWith('ation')) return token.slice(0, -5);
      if (token.length > 7 && token.endsWith('ator')) return token.slice(0, -4);
      return token;
    });
}

function tokenMatches(queryToken, candidateToken) {
  if (queryToken === candidateToken) return true;
  if (Math.min(queryToken.length, candidateToken.length) < 4) return false;
  return queryToken.startsWith(candidateToken) || candidateToken.startsWith(queryToken);
}

export function keywordCoverage(keywords, candidate) {
  const queryTokens = [...new Set(normalizeTokens(keywords))];
  if (!queryTokens.length) return 0;
  const candidateTokens = normalizeTokens(candidate);
  const matched = queryTokens.filter(queryToken => candidateTokens.some(token => tokenMatches(queryToken, token)));
  return matched.length / queryTokens.length;
}

export function scoreListing(query, listing, now = new Date()) {
  const publishedAt = new Date(listing.publishedAt);
  const ageMs = Math.max(0, now.getTime() - publishedAt.getTime());
  const ageDays = ageMs / 86_400_000;
  const recency = Math.max(0, 1 - ageDays / query.maxAgeDays);
  const score = 70 * keywordCoverage(query.keywords, listing.title) +
    20 * keywordCoverage(query.keywords, listing.description) +
    10 * recency;
  return Math.round(score * 100) / 100;
}

export function isWithinAgeLimit(listing, query, now = new Date()) {
  const published = new Date(listing.publishedAt);
  return !Number.isNaN(published.getTime()) && published.getTime() >= now.getTime() - query.maxAgeDays * 86_400_000;
}
