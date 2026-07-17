import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSalary } from '../server/db/listingRepository.js';

test('formats complete and one-sided salary ranges', () => {
  assert.equal(formatSalary({ salary_min: 70000, salary_max: 85000, currency: 'USD' }), '$70,000–$85,000');
  assert.equal(formatSalary({ salary_min: 70000, salary_max: null, currency: 'USD' }), 'From $70,000');
  assert.equal(formatSalary({ salary_min: null, salary_max: 85000, currency: 'USD' }), 'Up to $85,000');
  assert.equal(formatSalary({ salary_min: null, salary_max: null, currency: 'USD' }), '');
});
