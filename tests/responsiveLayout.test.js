import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutModeForWidth } from '../src/lib/responsiveLayout.js';

test('uses mobile layout below 768 pixels', () => {
  assert.equal(layoutModeForWidth(0), 'mobile');
  assert.equal(layoutModeForWidth(767), 'mobile');
});

test('uses compact layout from 768 through 1199 pixels', () => {
  assert.equal(layoutModeForWidth(768), 'compact');
  assert.equal(layoutModeForWidth(1199), 'compact');
});

test('uses wide layout from 1200 pixels', () => {
  assert.equal(layoutModeForWidth(1200), 'wide');
  assert.equal(layoutModeForWidth(1440), 'wide');
});
