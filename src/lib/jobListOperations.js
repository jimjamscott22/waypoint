export function reorderVisibleJobs(allJobs, orderedVisibleIds) {
  if (orderedVisibleIds.length < 2) return allJobs;

  const orderedIdSet = new Set(orderedVisibleIds);
  if (orderedIdSet.size !== orderedVisibleIds.length) return allJobs;

  const jobsById = new Map(allJobs.map(job => [job.id, job]));
  if (orderedVisibleIds.some(id => !jobsById.has(id))) return allJobs;

  const currentVisibleIds = allJobs.filter(job => orderedIdSet.has(job.id)).map(job => job.id);
  if (currentVisibleIds.length !== orderedVisibleIds.length) return allJobs;
  if (currentVisibleIds.every((id, index) => id === orderedVisibleIds[index])) return allJobs;

  let visibleIndex = 0;
  return allJobs.map(job => {
    if (!orderedIdSet.has(job.id)) return job;
    const nextJob = jobsById.get(orderedVisibleIds[visibleIndex]);
    visibleIndex += 1;
    return nextJob;
  });
}

export function moveVisibleJob(allJobs, visibleIds, jobId, direction) {
  const currentIndex = visibleIds.indexOf(jobId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleIds.length) return allJobs;

  const orderedIds = [...visibleIds];
  [orderedIds[currentIndex], orderedIds[nextIndex]] = [orderedIds[nextIndex], orderedIds[currentIndex]];
  return reorderVisibleJobs(allJobs, orderedIds);
}

export function updateJob(allJobs, jobId, changes) {
  return allJobs.map(job => (job.id === jobId ? { ...job, ...changes, id: job.id } : job));
}

export function duplicateJob(allJobs, jobId, newId) {
  const sourceIndex = allJobs.findIndex(job => job.id === jobId);
  if (sourceIndex < 0) return { jobs: allJobs, duplicate: null };

  const source = allJobs[sourceIndex];
  const duplicate = {
    ...source,
    id: newId,
    role: `${source.role} (Copy)`,
    isDraft: false,
  };
  const jobs = [...allJobs];
  jobs.splice(sourceIndex + 1, 0, duplicate);
  return { jobs, duplicate };
}

export function deleteJob(allJobs, jobId) {
  const index = allJobs.findIndex(job => job.id === jobId);
  if (index < 0) return { jobs: allJobs, snapshot: null };

  return {
    jobs: allJobs.filter(job => job.id !== jobId),
    snapshot: { job: allJobs[index], index },
  };
}

export function restoreJob(allJobs, snapshot) {
  if (!snapshot || allJobs.some(job => job.id === snapshot.job.id)) return allJobs;
  const jobs = [...allJobs];
  const index = Math.max(0, Math.min(snapshot.index, jobs.length));
  jobs.splice(index, 0, snapshot.job);
  return jobs;
}

export function parseStoredJobs(raw, fallbackJobs) {
  if (!raw) return { jobs: fallbackJobs, notice: null };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { jobs: parsed, notice: null };
  } catch {
    // The recovery notice below covers invalid JSON and valid non-array JSON.
  }
  return {
    jobs: fallbackJobs,
    notice: 'Saved job data was invalid, so Waypoint restored the starter pipeline.',
  };
}
