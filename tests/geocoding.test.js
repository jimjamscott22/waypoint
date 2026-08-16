import test from 'node:test';
import assert from 'node:assert/strict';
import { createNominatimClient } from '../server/geocoding/nominatim.js';

const USER_AGENT = 'Waypoint/0.1 (contact: person@example.com)';

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => payload };
}

function auburnCandidate(overrides = {}) {
  return {
    display_name: 'Auburn, Cayuga County, New York, United States',
    lat: '42.9317',
    lon: '-76.5661',
    osm_id: 1234,
    ...overrides,
  };
}

function clientWith(fetchImpl, overrides = {}) {
  return createNominatimClient({
    baseUrl: 'https://nominatim.openstreetmap.org',
    userAgent: USER_AGENT,
    fetchImpl,
    ...overrides,
  });
}

test('requests Nominatim with the documented parameters and contact identity', async () => {
  const calls = [];
  const client = clientWith(async (url, options) => {
    calls.push({ url, options });
    return jsonResponse([auburnCandidate()]);
  });

  const candidates = await client.resolve('  Auburn NY  ');

  assert.equal(calls.length, 1);
  const url = calls[0].url;
  assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(url.searchParams.get('limit'), '5');
  assert.equal(url.searchParams.get('countrycodes'), 'us');
  assert.equal(url.searchParams.get('q'), 'Auburn NY');
  assert.equal(calls[0].options.headers['User-Agent'], USER_AGENT);
  assert.equal(calls[0].options.headers.Accept, 'application/json');

  assert.deepEqual(candidates, [{
    displayName: 'Auburn, Cayuga County, New York, United States',
    latitude: 42.9317,
    longitude: -76.5661,
    provider: 'nominatim',
    placeId: '1234',
  }]);
});

test('serializes lookups to at most one request per second', async () => {
  let clock = 0;
  const slept = [];
  const startedAt = [];
  const client = clientWith(async () => {
    startedAt.push(clock);
    return jsonResponse([auburnCandidate()]);
  }, {
    now: () => clock,
    sleep: async ms => { slept.push(ms); clock += ms; },
  });

  await Promise.all([client.resolve('Auburn NY'), client.resolve('Syracuse NY'), client.resolve('Ithaca NY')]);

  assert.deepEqual(slept, [1000, 1000]);
  assert.deepEqual(startedAt, [0, 1000, 2000]);
});

test('keeps the queue moving after a failed lookup', async () => {
  let attempt = 0;
  const client = clientWith(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error('network unreachable');
    return jsonResponse([auburnCandidate()]);
  }, { now: () => 0, sleep: async () => {} });

  await assert.rejects(client.resolve('Auburn NY'), /network unreachable/);
  const candidates = await client.resolve('Auburn NY');
  assert.equal(candidates.length, 1);
});

test('caps results at five and drops candidates with unusable coordinates', async () => {
  const client = clientWith(async () => jsonResponse([
    auburnCandidate({ osm_id: 1 }),
    auburnCandidate({ osm_id: 2, lat: 'not-a-number' }),
    auburnCandidate({ osm_id: 3, lat: '95.0' }),
    auburnCandidate({ osm_id: 4, display_name: '   ' }),
    auburnCandidate({ osm_id: 5 }),
    auburnCandidate({ osm_id: 6 }),
    auburnCandidate({ osm_id: 7 }),
  ]), { now: () => 0, sleep: async () => {} });

  const candidates = await client.resolve('Auburn NY');

  assert.deepEqual(candidates.map(candidate => candidate.placeId), ['1', '5']);
});

test('falls back to place_id when a candidate has no osm_id', async () => {
  const client = clientWith(
    async () => jsonResponse([{ display_name: 'Auburn, New York', lat: '42.9', lon: '-76.5', place_id: 987 }]),
    { now: () => 0, sleep: async () => {} }
  );
  const [candidate] = await client.resolve('Auburn NY');
  assert.equal(candidate.placeId, '987');
});

test('rejects a blank lookup without contacting the provider', async () => {
  let called = false;
  const client = clientWith(async () => { called = true; return jsonResponse([]); });

  await assert.rejects(client.resolve('   '), error => {
    assert.equal(error.statusCode, 400);
    assert.equal(error.code, 'INVALID_LOCATION_QUERY');
    return true;
  });
  assert.equal(called, false);
});

test('reports provider failures as sanitized upstream errors', async () => {
  const failing = clientWith(async () => jsonResponse(null, { ok: false, status: 503 }),
    { now: () => 0, sleep: async () => {} });

  await assert.rejects(failing.resolve('Auburn NY'), error => {
    assert.equal(error.statusCode, 502);
    assert.equal(error.code, 'LOCATION_LOOKUP_FAILED');
    assert.match(error.message, /HTTP 503/);
    return true;
  });

  const leaking = clientWith(async () => { throw new Error('connect failed for app_key=super-secret'); },
    { now: () => 0, sleep: async () => {} });

  await assert.rejects(leaking.resolve('Auburn NY'), error => {
    assert.equal(error.code, 'LOCATION_LOOKUP_FAILED');
    assert.match(error.message, /\[REDACTED\]/);
    assert.equal(error.message.includes('super-secret'), false);
    return true;
  });
});

test('aborts a stalled lookup through its own timeout', async () => {
  const client = clientWith((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason));
  }), { now: () => 0, sleep: async () => {}, timeoutMs: 5 });

  await assert.rejects(client.resolve('Auburn NY'), /timed out/i);
});

test('refuses to build a client without a contact identity', () => {
  assert.throws(
    () => createNominatimClient({ baseUrl: 'https://example.com', userAgent: '' }),
    /contact User-Agent/
  );
});
