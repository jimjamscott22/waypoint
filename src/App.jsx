import { useJobsStore } from './hooks/useJobsStore';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CaptureBar from './components/CaptureBar';
import PipelineTable from './components/PipelineTable';
import JobDetailPanel from './components/JobDetailPanel';
import ReviewQueue from './components/ReviewQueue';
import Toast from './components/Toast';

export default function App() {
  const store = useJobsStore();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', minWidth: 1280 }}>
      <Sidebar />

      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Header />
        <CaptureBar onCapture={store.captureJob} />
        <PipelineTable
          jobs={store.jobs}
          totalCount={store.totalCount}
          tabs={store.tabs}
          stageFilter={store.stageFilter}
          onSelectStage={store.setStageFilter}
          onSelectJob={store.selectJob}
          onEditJob={store.editJob}
          onDuplicateJob={store.duplicateJob}
          onDeleteJob={store.deleteJob}
          onChangeStage={store.changeJobStage}
          onReorderJobs={store.reorderJobs}
          onMoveJob={store.moveJob}
          onUpdateDraftField={store.updateDraftField}
          onCommitDraft={store.commitDraft}
          onDiscardDraft={store.discardDraft}
        />
      </main>

      <ReviewQueue queue={store.queue} onSave={store.saveToPipeline} onDismiss={store.dismissMatch} />

      {store.selectedJob ? (
        <JobDetailPanel
          key={store.selectedJob.id}
          job={store.selectedJob}
          initialMode={store.selectedJobMode}
          onClose={store.clearSelection}
          onSave={store.updateJob}
          onDuplicate={store.duplicateJob}
          onDelete={store.deleteJob}
        />
      ) : null}

      <Toast toast={store.toast} onUndo={store.undoDelete} onDismiss={store.dismissToast} drawerOpen={Boolean(store.selectedJob)} />
    </div>
  );
}
