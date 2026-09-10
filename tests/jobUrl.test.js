import test from 'node:test';
import assert from 'node:assert/strict';
import { externalJobUrl } from '../src/lib/jobUrl.js';

test('returns trimmed HTTP and HTTPS job posting URLs', () => {
  assert.equal(externalJobUrl(' https://jobs.example.test/roles/42?source=waypoint '), 'https://jobs.example.test/roles/42?source=waypoint');
  assert.equal(externalJobUrl('http://jobs.example.test/roles/42'), 'http://jobs.example.test/roles/42');
});

test('rejects missing, relative, and non-web job posting URLs', () => {
  assert.equal(externalJobUrl(null), null);
  assert.equal(externalJobUrl(''), null);
  assert.equal(externalJobUrl('/roles/42'), null);
  assert.equal(externalJobUrl('javascript:alert(1)'), null);
  assert.equal(externalJobUrl('mailto:jobs@example.test'), null);
});
