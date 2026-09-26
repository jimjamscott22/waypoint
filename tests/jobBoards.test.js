import test from 'node:test';
import assert from 'node:assert/strict';
import { JOB_BOARDS, boardHost, buildBoardSearchUrl } from '../src/lib/jobBoards.js';

const board = id => JOB_BOARDS.find(item => item.id === id);

test('lists at least five boards with unique ids and complete copy', () => {
  assert.ok(JOB_BOARDS.length >= 5);
  assert.equal(new Set(JOB_BOARDS.map(item => item.id)).size, JOB_BOARDS.length);
  for (const item of JOB_BOARDS) {
    assert.ok(item.name && item.description && item.category, item.id);
    assert.ok(item.bestFor.length > 0, item.id);
    assert.equal(new URL(item.url).protocol, 'https:', item.id);
    if (item.search) assert.equal(new URL(item.search.url).protocol, 'https:', item.id);
    else assert.ok(item.note, `${item.id} needs a note explaining how to search`);
  }
});

test('builds a search URL with encoded keywords and location', () => {
  assert.equal(
    buildBoardSearchUrl(board('indeed'), { keywords: ' junior developer ', location: 'Syracuse, NY' }),
    'https://www.indeed.com/jobs?q=junior+developer&l=Syracuse%2C+NY',
  );
});

test('omits location for boards without a location parameter', () => {
  assert.equal(
    buildBoardSearchUrl(board('builtin'), { keywords: 'data analyst', location: 'Remote' }),
    'https://builtin.com/jobs?search=data+analyst',
  );
});

test('omits a blank location', () => {
  assert.equal(
    buildBoardSearchUrl(board('usajobs'), { keywords: 'IT specialist', location: '  ' }),
    'https://www.usajobs.gov/Search/Results?k=IT+specialist',
  );
});

test('falls back to the landing page without keywords or a search link', () => {
  assert.equal(buildBoardSearchUrl(board('dice'), { keywords: '   ', location: 'Austin' }), board('dice').url);
  assert.equal(buildBoardSearchUrl(board('dice')), board('dice').url);
  assert.equal(buildBoardSearchUrl(board('handshake'), { keywords: 'analyst' }), board('handshake').url);
});

test('shows a bare host name', () => {
  assert.equal(boardHost(board('linkedin')), 'linkedin.com');
  assert.equal(boardHost(board('handshake')), 'joinhandshake.com');
});
