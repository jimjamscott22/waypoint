import { useState, useEffect, useMemo, useCallback } from 'react';
import { STAGES } from '../lib/seedData';
import { parseJobUrl } from '../lib/parseJobUrl';
import {
  duplicateJob as copyJob,
  moveVisibleJob,
  reorderVisibleJobs,
  updateJob as replaceJob,
} from '../lib/jobListOperations';
import { api } from '../lib/apiClient';
import { parseLegacyJobs } from '../lib/legacyImport';

const STORAGE_KEY = 'waypoint.jobs';
const TOAST_DURATION_MS = 6000;
const toastId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function importCandidate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseLegacyJobs(raw);
  } catch (error) {
    return { error: error.message, jobs: [] };
  }
}

export function useJobsStore() {
  const [jobs, setJobs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queries, setQueries] = useState([]);
  const [latestRun, setLatestRun] = useState(null);
  const [provider, setProvider] = useState(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [migration, setMigration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stageFilter, setStageFilter] = useState('All');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobMode, setSelectedJobMode] = useState('view');
  const [deletedJobId, setDeletedJobId] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, tone = 'success', action = null) => {
    if (action !== 'undo-delete') setDeletedJobId(null);
    setToast({ id: toastId(), message, tone, action });
  }, []);

  const applyBootstrap = useCallback(payload => {
    setJobs(payload.jobs);
    setQueue(payload.matches);
    setQueries(payload.queries);
    setLatestRun(payload.latestRun);
    setProvider(payload.provider);
    setProviderConfigured(payload.providerConfigured);
    if (payload.serverJobsEmpty) {
      const candidate = importCandidate();
      if (candidate?.error) notify(candidate.error, 'error');
      if (candidate) setMigration(candidate);
    }
  }, [notify]);

  const refresh = useCallback(async () => {
    const payload = await api.bootstrap();
    applyBootstrap(payload);
    return payload;
  }, [applyBootstrap]);

  useEffect(() => {
    refresh()
      .catch(error => notify(`Waypoint could not connect to the server: ${error.message}`, 'error'))
      .finally(() => setLoading(false));
  }, [refresh, notify]);

  const fail = useCallback(async error => {
    notify(error.message, 'error');
    await refresh().catch(() => {});
  }, [notify, refresh]);

  const dismissToast = useCallback(() => { setToast(null); setDeletedJobId(null); }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(dismissToast, TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [toast, dismissToast]);

  const visibleJobs = useMemo(
    () => jobs.filter(job => job.isDraft || stageFilter === 'All' || job.stage === stageFilter),
    [jobs, stageFilter]
  );
  const tabs = useMemo(() => STAGES.map(stage => ({
    stage,
    count: stage === 'All' ? jobs.length : jobs.filter(job => job.stage === stage).length,
  })), [jobs]);

  const captureJob = useCallback(async url => {
    try {
      const draft = await parseJobUrl(url);
      const { job } = await api.createJob({ ...draft, stage: 'Saved', next: 'Tailor resume & apply', urgent: false, isDraft: true });
      setJobs(previous => [job, ...previous]);
    } catch (error) { await fail(error); }
  }, [fail]);
  const updateDraftField = useCallback((id, field, value) => setJobs(previous => replaceJob(previous, id, { [field]: value })), []);
  const commitDraft = useCallback(async id => {
    const draft = jobs.find(job => job.id === id);
    if (!draft) return;
    try {
      const { job } = await api.updateJob(id, {
        role: draft.role, company: draft.company, location: draft.location,
        salary: draft.salary, contact: draft.contact, isDraft: false,
      });
      setJobs(previous => replaceJob(previous, id, job));
      notify('Job added to your pipeline.');
    } catch (error) { await fail(error); }
  }, [jobs, notify, fail]);
  const discardDraft = useCallback(async id => {
    try { await api.deleteJob(id); setJobs(previous => previous.filter(job => job.id !== id)); }
    catch (error) { await fail(error); }
  }, [fail]);

  const saveToPipeline = useCallback(async id => {
    try {
      const { job } = await api.saveListing(id);
      setJobs(previous => [job, ...previous.filter(item => item.id !== job.id)]);
      setQueue(previous => previous.filter(item => item.id !== id));
      notify('Match saved to your pipeline.');
    } catch (error) { await fail(error); }
  }, [notify, fail]);
  const dismissMatch = useCallback(async id => {
    try { await api.dismissListing(id); setQueue(previous => previous.filter(item => item.id !== id)); }
    catch (error) { await fail(error); }
  }, [fail]);

  const updateJob = useCallback(async (id, changes, message = 'Job details saved.') => {
    try {
      const { job } = await api.updateJob(id, changes);
      setJobs(previous => replaceJob(previous, id, job));
      notify(message);
    } catch (error) { await fail(error); }
  }, [notify, fail]);
  const changeJobStage = useCallback((id, stage) => updateJob(id, { stage }, `Job moved to ${stage}.`), [updateJob]);

  const persistOrder = useCallback(async nextJobs => {
    setJobs(nextJobs);
    try {
      const { jobs: ordered } = await api.reorderJobs(nextJobs.map(job => job.id));
      setJobs(ordered);
      notify('Job priority updated.');
    }
    catch (error) { await fail(error); }
  }, [notify, fail]);
  const reorderJobs = useCallback(visibleIds => persistOrder(reorderVisibleJobs(jobs, visibleIds)), [jobs, persistOrder]);
  const moveJob = useCallback((id, direction, visibleIds) => persistOrder(moveVisibleJob(jobs, visibleIds, id, direction)), [jobs, persistOrder]);

  const duplicateJob = useCallback(async id => {
    const source = jobs.find(job => job.id === id);
    if (!source) return;
    const preview = copyJob([source], source.id, 'preview').jobs[1];
    try {
      const { job } = await api.createJob({
        role: preview.role, company: preview.company, stage: preview.stage, location: preview.location,
        salary: preview.salary, contact: preview.contact, next: preview.next, notes: preview.notes ?? '',
        urgent: preview.urgent, isDraft: false, url: preview.url,
      });
      setJobs(previous => [job, ...previous]);
      setSelectedJobId(job.id);
      setSelectedJobMode('edit');
      notify('Job duplicated. Review the copy before saving changes.');
    } catch (error) { await fail(error); }
  }, [jobs, notify, fail]);

  const clearSelection = useCallback(() => { setSelectedJobId(null); setSelectedJobMode('view'); }, []);
  const deleteJob = useCallback(async id => {
    try {
      await api.deleteJob(id);
      setJobs(previous => previous.filter(job => job.id !== id));
      setDeletedJobId(id);
      if (selectedJobId === id) clearSelection();
      setToast({ id: toastId(), message: 'Job deleted.', tone: 'success', action: 'undo-delete' });
    } catch (error) { await fail(error); }
  }, [selectedJobId, clearSelection, fail]);
  const undoDelete = useCallback(async () => {
    if (!deletedJobId) return;
    try {
      const { job } = await api.restoreJob(deletedJobId);
      setJobs(previous => [...previous, job].sort((a, b) => a.sortOrder - b.sortOrder));
      notify('Job restored.');
    } catch (error) { await fail(error); }
  }, [deletedJobId, notify, fail]);

  const createQuery = useCallback(async input => {
    try { const { query } = await api.createQuery(input); setQueries(previous => [...previous, query]); notify('Saved query created.'); }
    catch (error) { await fail(error); }
  }, [notify, fail]);
  const updateQuery = useCallback(async (id, changes) => {
    try { const { query } = await api.updateQuery(id, changes); setQueries(previous => previous.map(item => item.id === id ? query : item)); notify('Saved query updated.'); }
    catch (error) { await fail(error); }
  }, [notify, fail]);
  const deleteQuery = useCallback(async id => {
    try { await api.deleteQuery(id); setQueries(previous => previous.filter(item => item.id !== id)); notify('Saved query deleted.'); }
    catch (error) { await fail(error); }
  }, [notify, fail]);

  const runScrape = useCallback(async () => {
    setRunning(true);
    try {
      const { run } = await api.runScrape();
      setLatestRun(run);
      await refresh();
      notify(`Scrape ${run.status}: ${run.newMatches} new matches.`);
    } catch (error) { await fail(error); }
    finally { setRunning(false); }
  }, [refresh, notify, fail]);

  const importLocalJobs = useCallback(async () => {
    if (!migration) return;
    try {
      const { jobs: imported } = await api.importJobs(migration.jobs);
      localStorage.removeItem(STORAGE_KEY);
      setJobs(imported);
      setMigration(null);
      notify(`${imported.length} jobs imported.`);
    } catch (error) { await fail(error); }
  }, [migration, notify, fail]);
  const discardLocalJobs = useCallback(() => { localStorage.removeItem(STORAGE_KEY); setMigration(null); }, []);

  const selectedJob = useMemo(() => jobs.find(job => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  return {
    jobs: visibleJobs, totalCount: jobs.length, stageFilter, setStageFilter, tabs, queue, queries,
    latestRun, provider, providerConfigured, running, loading, migration, selectedJob, selectedJobMode, toast,
    captureJob, updateDraftField, commitDraft, discardDraft, saveToPipeline, dismissMatch,
    selectJob: id => { setSelectedJobId(id); setSelectedJobMode('view'); },
    editJob: id => { setSelectedJobId(id); setSelectedJobMode('edit'); },
    clearSelection, updateJob, changeJobStage, reorderJobs, moveJob, duplicateJob, deleteJob, undoDelete, dismissToast,
    createQuery, updateQuery, deleteQuery, runScrape, importLocalJobs, discardLocalJobs,
  };
}
