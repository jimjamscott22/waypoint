import { useState, useEffect, useMemo, useCallback } from 'react';
import { STAGES, INITIAL_JOBS, INITIAL_QUEUE } from '../lib/seedData';
import { parseJobUrl } from '../lib/parseJobUrl';
import {
  deleteJob as removeJob,
  duplicateJob as copyJob,
  moveVisibleJob,
  parseStoredJobs,
  reorderVisibleJobs,
  restoreJob,
  updateJob as replaceJob,
} from '../lib/jobListOperations';

const STORAGE_KEY = 'waypoint.jobs';
const TOAST_DURATION_MS = 6000;

function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parseStoredJobs(raw, INITIAL_JOBS);
  } catch (error) {
    return {
      jobs: INITIAL_JOBS,
      notice: `Waypoint could not read saved jobs: ${error instanceof Error ? error.message : 'unknown storage error'}`,
    };
  }
}

function createJobId(prefix = 'job') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useJobsStore() {
  const [initialState] = useState(loadJobs);
  const [jobs, setJobs] = useState(initialState.jobs);
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [stageFilter, setStageFilter] = useState('All');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobMode, setSelectedJobMode] = useState('view');
  const [deletedSnapshot, setDeletedSnapshot] = useState(null);
  const [toast, setToast] = useState(
    initialState.notice ? { id: createJobId('toast'), message: initialState.notice, tone: 'error' } : null
  );

  const notify = useCallback((message, tone = 'success', action = null) => {
    if (action !== 'undo-delete') setDeletedSnapshot(null);
    setToast({ id: createJobId('toast'), message, tone, action });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
    setDeletedSnapshot(null);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(dismissToast, TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [toast, dismissToast]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch (error) {
      setToast({
        id: createJobId('toast'),
        message: `Changes are only in memory because Waypoint could not save locally: ${error instanceof Error ? error.message : 'unknown storage error'}`,
        tone: 'error',
        action: null,
      });
    }
  }, [jobs]);

  const visibleJobs = useMemo(
    () => jobs.filter(job => job.isDraft || stageFilter === 'All' || job.stage === stageFilter),
    [jobs, stageFilter]
  );

  const tabs = useMemo(
    () => STAGES.map(stage => ({
      stage,
      count: stage === 'All' ? jobs.length : jobs.filter(job => job.stage === stage).length,
    })),
    [jobs]
  );

  const captureJob = useCallback(async url => {
    const draft = await parseJobUrl(url);
    setJobs(previousJobs => [
      {
        id: createJobId('draft'),
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
      ...previousJobs,
    ]);
  }, []);

  const updateDraftField = useCallback((id, field, value) => {
    setJobs(previousJobs => replaceJob(previousJobs, id, { [field]: value }));
  }, []);

  const commitDraft = useCallback(id => {
    setJobs(previousJobs => replaceJob(previousJobs, id, { isDraft: false }));
    notify('Job added to your pipeline.');
  }, [notify]);

  const discardDraft = useCallback(id => {
    setJobs(previousJobs => removeJob(previousJobs, id).jobs);
  }, []);

  const saveToPipeline = useCallback(queueId => {
    const match = queue.find(item => item.id === queueId);
    if (!match) return;
    setJobs(previousJobs => [
      {
        id: createJobId(),
        role: match.role,
        company: match.company,
        stage: 'Saved',
        location: match.meta.split(' · ')[0] ?? '',
        salary: '',
        contact: '—',
        next: 'Tailor resume & apply',
        urgent: false,
      },
      ...previousJobs,
    ]);
    setQueue(previousQueue => previousQueue.filter(item => item.id !== queueId));
    notify('Match saved to your pipeline.');
  }, [queue, notify]);

  const dismissMatch = useCallback(queueId => {
    setQueue(previousQueue => previousQueue.filter(item => item.id !== queueId));
  }, []);

  const selectJob = useCallback(id => {
    setSelectedJobId(id);
    setSelectedJobMode('view');
  }, []);

  const editJob = useCallback(id => {
    setSelectedJobId(id);
    setSelectedJobMode('edit');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedJobId(null);
    setSelectedJobMode('view');
  }, []);

  const updateJob = useCallback((id, changes) => {
    setJobs(previousJobs => replaceJob(previousJobs, id, changes));
    notify('Job details saved.');
  }, [notify]);

  const changeJobStage = useCallback((id, stage) => {
    setJobs(previousJobs => replaceJob(previousJobs, id, { stage }));
    notify(`Job moved to ${stage}.`);
  }, [notify]);

  const reorderJobs = useCallback(orderedVisibleIds => {
    setJobs(previousJobs => reorderVisibleJobs(previousJobs, orderedVisibleIds));
    notify('Job priority updated.');
  }, [notify]);

  const moveJob = useCallback((jobId, direction, visibleIds) => {
    setJobs(previousJobs => moveVisibleJob(previousJobs, visibleIds, jobId, direction));
    notify('Job priority updated.');
  }, [notify]);

  const duplicateJob = useCallback(id => {
    const newId = createJobId();
    setJobs(previousJobs => copyJob(previousJobs, id, newId).jobs);
    setSelectedJobId(newId);
    setSelectedJobMode('edit');
    notify('Job duplicated. Review the copy before saving changes.');
  }, [notify]);

  const deleteJob = useCallback(id => {
    const result = removeJob(jobs, id);
    if (!result.snapshot) return;
    setJobs(result.jobs);
    setDeletedSnapshot(result.snapshot);
    if (selectedJobId === id) clearSelection();
    setToast({ id: createJobId('toast'), message: 'Job deleted.', tone: 'success', action: 'undo-delete' });
  }, [jobs, selectedJobId, clearSelection]);

  const undoDelete = useCallback(() => {
    if (!deletedSnapshot) return;
    setJobs(previousJobs => restoreJob(previousJobs, deletedSnapshot));
    setDeletedSnapshot(null);
    setToast({ id: createJobId('toast'), message: 'Job restored.', tone: 'success', action: null });
  }, [deletedSnapshot]);

  const selectedJob = useMemo(
    () => jobs.find(job => job.id === selectedJobId) ?? null,
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
    selectedJobMode,
    toast,
    captureJob,
    updateDraftField,
    commitDraft,
    discardDraft,
    saveToPipeline,
    dismissMatch,
    selectJob,
    editJob,
    clearSelection,
    updateJob,
    changeJobStage,
    reorderJobs,
    moveJob,
    duplicateJob,
    deleteJob,
    undoDelete,
    dismissToast,
  };
}
