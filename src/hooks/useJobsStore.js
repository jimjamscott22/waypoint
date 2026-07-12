import { useState, useEffect, useMemo, useCallback } from 'react';
import { STAGES, INITIAL_JOBS, INITIAL_QUEUE } from '../lib/seedData';
import { parseJobUrl } from '../lib/parseJobUrl';

const STORAGE_KEY = 'waypoint.jobs';

function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_JOBS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_JOBS;
    return parsed;
  } catch {
    return INITIAL_JOBS;
  }
}

export function useJobsStore() {
  const [jobs, setJobs] = useState(loadJobs);
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [stageFilter, setStageFilter] = useState('All');
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const visibleJobs = useMemo(
    () => jobs.filter(j => j.isDraft || stageFilter === 'All' || j.stage === stageFilter),
    [jobs, stageFilter]
  );

  const tabs = useMemo(
    () => STAGES.map(stage => ({
      stage,
      count: stage === 'All' ? jobs.length : jobs.filter(j => j.stage === stage).length,
    })),
    [jobs]
  );

  const captureJob = useCallback(async url => {
    const draft = await parseJobUrl(url);
    const id = `draft-${Date.now()}`;
    setJobs(prev => [
      {
        id,
        role: draft.role,
        company: draft.company,
        location: draft.location,
        salary: draft.salary,
        contact: draft.contact,
        stage: 'Saved',
        next: 'Tailor resume & apply',
        urgent: false,
        isDraft: true,
        url: draft.url,
      },
      ...prev,
    ]);
  }, []);

  const updateDraftField = useCallback((id, field, value) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, [field]: value } : j)));
  }, []);

  const commitDraft = useCallback(id => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, isDraft: false } : j)));
  }, []);

  const discardDraft = useCallback(id => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const saveToPipeline = useCallback(
    queueId => {
      const match = queue.find(q => q.id === queueId);
      if (!match) return;
      setJobs(prev => [
        {
          id: `job-${match.id}`,
          role: match.role,
          company: match.company,
          stage: 'Saved',
          location: match.meta.split(' · ')[0] ?? '',
          salary: '',
          contact: '—',
          next: 'Tailor resume & apply',
          urgent: false,
        },
        ...prev,
      ]);
      setQueue(prev => prev.filter(q => q.id !== queueId));
    },
    [queue]
  );

  const dismissMatch = useCallback(queueId => {
    setQueue(prev => prev.filter(q => q.id !== queueId));
  }, []);

  const selectJob = useCallback(id => setSelectedJobId(id), []);
  const clearSelection = useCallback(() => setSelectedJobId(null), []);

  const selectedJob = useMemo(
    () => jobs.find(j => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  return {
    jobs: visibleJobs,
    totalCount: jobs.length,
    stageFilter,
    setStageFilter,
    tabs,
    queue,
    selectedJob,
    captureJob,
    updateDraftField,
    commitDraft,
    discardDraft,
    saveToPipeline,
    dismissMatch,
    selectJob,
    clearSelection,
  };
}
