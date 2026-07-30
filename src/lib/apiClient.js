async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Request failed with HTTP ${response.status}`);
    error.code = payload.error?.code || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return payload;
}

const body = value => JSON.stringify(value);

export const api = {
  bootstrap: () => request('/api/bootstrap'),
  createJob: job => request('/api/jobs', { method: 'POST', body: body(job) }),
  updateJob: (id, changes) => request(`/api/jobs/${id}`, { method: 'PATCH', body: body(changes) }),
  deleteJob: id => request(`/api/jobs/${id}`, { method: 'DELETE' }),
  restoreJob: id => request(`/api/jobs/${id}/restore`, { method: 'POST' }),
  reorderJobs: orderedIds => request('/api/jobs/reorder', { method: 'POST', body: body({ orderedIds }) }),
  importJobs: jobs => request('/api/jobs/import', { method: 'POST', body: body({ jobs }) }),
  createQuery: query => request('/api/queries', { method: 'POST', body: body(query) }),
  updateQuery: (id, changes) => request(`/api/queries/${id}`, { method: 'PATCH', body: body(changes) }),
  deleteQuery: id => request(`/api/queries/${id}`, { method: 'DELETE' }),
  saveListing: id => request(`/api/listings/${id}/save`, { method: 'POST' }),
  dismissListing: id => request(`/api/listings/${id}/dismiss`, { method: 'POST' }),
  runScrape: () => request('/api/scrape-runs', { method: 'POST' }),
  insights: (range = '90d') => request(`/api/insights?range=${encodeURIComponent(range)}`),
};
