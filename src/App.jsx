import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CaptureBar from './components/CaptureBar';
import PipelineTable from './components/PipelineTable';
import JobDetailPanel from './components/JobDetailPanel';
import { useJobsStore } from './hooks/useJobsStore';

export default function App() {
  const store = useJobsStore();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1 }}>
        <Header />
        <CaptureBar onCapture={store.captureJob} />
        <PipelineTable
          jobs={store.jobs}
          totalCount={store.totalCount}
          tabs={store.tabs}
          stageFilter={store.stageFilter}
          onSelectStage={store.setStageFilter}
          onSelectJob={id => store.selectJob(id)}
          onUpdateDraftField={store.updateDraftField}
          onCommitDraft={store.commitDraft}
          onDiscardDraft={store.discardDraft}
        />
        {store.selectedJob && <JobDetailPanel job={store.selectedJob} onClose={store.clearSelection} />}
      </main>
    </div>
  );
}
