import { useJobsStore } from './hooks/useJobsStore';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CaptureBar from './components/CaptureBar';
import PipelineTable from './components/PipelineTable';
import JobDetailPanel from './components/JobDetailPanel';
import ReviewQueue from './components/ReviewQueue';
import Toast from './components/Toast';
import MigrationBanner from './components/MigrationBanner';
import InsightsView from './components/InsightsView';
import { color, font } from './theme';

export default function App() {
  const store = useJobsStore();

  if (store.loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: color.textSecondary, font: `500 14px ${font.body}` }}>Connecting to Waypoint…</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', minWidth: 1280 }}>
      <Sidebar activeView={store.activeView} onSelectView={store.setActiveView} />

      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {store.activeView === 'Pipeline' ? (
          <>
            <Header />
            {store.migration ? <MigrationBanner count={store.migration.jobs.length} error={store.migration.error} onImport={store.importLocalJobs} onDiscard={store.discardLocalJobs} /> : null}
            <CaptureBar
              onCapture={store.captureJob}
              queries={store.queries}
              onCreateQuery={store.createQuery}
              onUpdateQuery={store.updateQuery}
              onDeleteQuery={store.deleteQuery}
              focusQueryId={store.focusedQueryId}
              onFocusQueryHandled={store.clearFocusedQuery}
            />
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
          </>
        ) : (
          <InsightsView
            data={store.insights}
            loading={store.insightsLoading}
            error={store.insightsError}
            range={store.insightsRange}
            onChangeRange={store.setInsightsRange}
            onRetry={store.retryInsights}
            onOpenJob={store.openInsightJob}
            onOpenQuery={store.openInsightQuery}
          />
        )}
      </main>

      {store.activeView === 'Pipeline' ? (
        <ReviewQueue
          queue={store.queue}
          latestRun={store.latestRun}
          provider={store.provider}
          providerConfigured={store.providerConfigured}
          running={store.running}
          onRun={store.runScrape}
          onSave={store.saveToPipeline}
          onDismiss={store.dismissMatch}
        />
      ) : null}

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
