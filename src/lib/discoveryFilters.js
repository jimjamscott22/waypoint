export const DEFAULT_DISCOVERY_FILTERS = Object.freeze({
  q: '',
  queryId: '',
  roleFamily: '',
  distanceBand: '',
  maxAgeDays: '',
  minScore: '',
  maxScore: '',
  salaryStatus: 'all',
  minSalary: '',
  status: 'new',
  sort: 'best',
  page: 1,
  pageSize: 25,
});

// Fixed order keeps generated query strings stable for caching and assertions.
const KEY_ORDER = Object.freeze([
  'q', 'queryId', 'roleFamily', 'distanceBand', 'maxAgeDays',
  'minScore', 'maxScore', 'salaryStatus', 'minSalary', 'status',
  'sort', 'page', 'pageSize',
]);

function isOmitted(key, value) {
  if (value == null || value === '') return true;
  return value === DEFAULT_DISCOVERY_FILTERS[key];
}

function serialize(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export function toDiscoverySearchParams(filters = {}) {
  const params = new URLSearchParams();
  for (const key of KEY_ORDER) {
    const value = filters[key];
    if (isOmitted(key, value)) continue;
    params.set(key, serialize(value));
  }
  return params;
}

export function countActiveDiscoveryFilters(filters = {}) {
  // Sort and pagination describe presentation, not filtering.
  return KEY_ORDER
    .filter(key => !['sort', 'page', 'pageSize'].includes(key))
    .filter(key => !isOmitted(key, filters[key]))
    .length;
}

export function resetDiscoveryPage(filters) {
  return { ...filters, page: 1 };
}
