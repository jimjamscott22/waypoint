import test from 'node:test';
import assert from 'node:assert/strict';
import { descriptionSnippet, explainMatch, highlightSegments } from '../src/lib/matchExplanation.js';

const facts = (overrides = {}) => ({ matchedSynonyms: [], requiredTerms: [], optionalTerms: [], excludedTerms: [], ...overrides });

test('uses the nearest distance and best band across matching queries', () => {
  const explanation = explainMatch({
    matchedQueries: [
      { score: 70, distanceMiles: 27.9, distanceBand: 'expanded', matchFacts: facts() },
      { score: 64, distanceMiles: 4.2, distanceBand: 'preferred', matchFacts: facts() },
    ],
  });
  assert.deepEqual(explanation.distance, { band: 'preferred', miles: 4.2, label: '4 mi · in preferred area' });
});

test('distinguishes a known-unknown distance from matches saved before distance scoring', () => {
  assert.deepEqual(
    explainMatch({ matchedQueries: [{ distanceMiles: null, distanceBand: 'unknown', matchFacts: facts() }] }).distance,
    { band: 'unknown', miles: null, label: 'Distance unknown' }
  );
  assert.equal(explainMatch({ matchedQueries: [{ score: 50, distanceMiles: null, distanceBand: null, matchFacts: null }] }).distance, null);
  assert.equal(explainMatch({ matchedQueries: [{ distanceMiles: 0.4, distanceBand: 'preferred' }] }).distance.label, '<1 mi · in preferred area');
});

test('merges title and term evidence across queries without duplicates', () => {
  const explanation = explainMatch({
    roleFamilies: ['it-support', 'not-a-family'],
    matchedQueries: [
      { matchFacts: facts({ matchedSynonyms: ['help desk'], optionalTerms: ['Windows'] }) },
      { matchFacts: facts({ matchedSynonyms: ['Help Desk', 'IT support'], requiredTerms: ['Active Directory'] }) },
    ],
  });
  assert.deepEqual(explanation.titleMatches, ['help desk', 'IT support']);
  assert.deepEqual(explanation.requiredTerms, ['Active Directory']);
  assert.deepEqual(explanation.optionalTerms, ['Windows']);
  assert.deepEqual(explanation.roleFamilies, ['IT support']);
  assert.deepEqual(explanation.highlightTerms, ['help desk', 'IT support', 'Active Directory', 'Windows']);
  assert.equal(explanation.hasEvidence, true);
});

test('labels work type and tolerates matches with no evidence at all', () => {
  const explanation = explainMatch({ contractTime: 'full_time', contractType: 'contract' });
  assert.deepEqual(explanation.workType, ['Full-time', 'Contract']);
  assert.equal(explanation.hasEvidence, false);
  assert.deepEqual(explainMatch({}).workType, []);
});

test('snippets collapse whitespace and cut at a word boundary', () => {
  assert.deepEqual(descriptionSnippet('  Short   text\n here '), { text: 'Short text here', truncated: false });
  const long = `${'word '.repeat(60)}end`;
  const snippet = descriptionSnippet(long, 50);
  assert.equal(snippet.truncated, true);
  assert.ok(snippet.text.endsWith('word…'));
  assert.ok(snippet.text.length <= 51);
  assert.deepEqual(descriptionSnippet(null), { text: '', truncated: false });
});

test('highlights matched terms case-insensitively, preferring the longest term', () => {
  const segments = highlightSegments('Join our Help Desk Analyst team. Help desk and windows experience.', ['help desk', 'help desk analyst', 'Windows']);
  assert.deepEqual(segments.filter(segment => segment.match).map(segment => segment.text), ['Help Desk Analyst', 'Help desk', 'windows']);
  assert.equal(segments.map(segment => segment.text).join(''), 'Join our Help Desk Analyst team. Help desk and windows experience.');
});

test('highlighting escapes regex characters and handles empty input', () => {
  const segments = highlightSegments('Knows C++ and .NET (Core)', ['C++', '.NET (Core)']);
  assert.equal(segments.map(segment => segment.text).join(''), 'Knows C++ and .NET (Core)');
  assert.deepEqual(segments.filter(segment => segment.match).map(segment => segment.text), ['C++', '.NET (Core)']);
  // Terms start on a word boundary, so "admin" does not light up inside "sysadmin".
  assert.equal(highlightSegments('sysadmin', ['admin']).some(segment => segment.match), false);
  assert.deepEqual(highlightSegments('plain text', []), [{ text: 'plain text', match: false }]);
  assert.deepEqual(highlightSegments('', ['x']), []);
});
