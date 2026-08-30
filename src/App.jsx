import { useJobsStore } from './hooks/useJobsStore';
import Sidebar from './components/Sidebar';
import PipelineRoute from './components/PipelineRoute';
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
  const mobile = store.layoutMode === 'mobile';
  const wide = store.layoutMode === 'wide';
  const showPipeline = store.activeView === 'Pipeline' || (wide && store.activeView === 'Review');
  const showReviewPage = !wide && store.activeView === 'Review';

  if (store.loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: color.textSecondary, font: `500 14px ${font.body}` }}>Connecting to Waypoint…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', minHeight: '100vh', background: color.pageBg }}>
      <Sidebar activeView={store.activeView} onSelectView={store.setActiveView} layoutMode={store.layoutMode} reviewCount={store.queue.length} />

      <main style={{ flex: 1, minWidth: 0, width: mobile ? '100%' : 'auto', padding: mobile ? '20px 16px 96px' : store.layoutMode === 'compact' ? '28px 24px 44px' : '32px 28px 48px', display: 'flex', flexDirection: 'column', gap: mobile ? 16 : 20 }}>
        {showPipeline ? (
          <>
            <PipelineRoute tabs={store.tabs} stageFilter={store.stageFilter} onSelectStage={store.setStageFilter} layoutMode={store.layoutMode} />
            {store.migration ? <MigrationBanner count={store.migration.jobs.length} error={store.migration.error} onImport={store.importLocalJobs} onDiscard={store.discardLocalJobs} /> : null}
            <CaptureBar
              layoutMode={store.layoutMode}
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
              stageFilter={store.stageFilter}
              layoutMode={store.layoutMode}
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
        ) : showReviewPage ? (
          <ReviewQueue
            queue={store.queue}
            latestRun={store.latestRun}
            provider={store.provider}
            providerConfigured={store.providerConfigured}
            running={store.running}
            onRun={store.runScrape}
            onSave={store.saveToPipeline}
            onDismiss={store.dismissMatch}
            layoutMode={store.layoutMode}
          />
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
            layoutMode={store.layoutMode}
          />
        )}
      </main>

      {wide && showPipeline ? (
        <ReviewQueue
          queue={store.queue}
          latestRun={store.latestRun}
          provider={store.provider}
          providerConfigured={store.providerConfigured}
          running={store.running}
          onRun={store.runScrape}
          onSave={store.saveToPipeline}
          onDismiss={store.dismissMatch}
          layoutMode={store.layoutMode}
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
          layoutMode={store.layoutMode}
        />
      ) : null}

      <Toast toast={store.toast} onUndo={store.undoDelete} onDismiss={store.dismissToast} drawerOpen={Boolean(store.selectedJob)} layoutMode={store.layoutMode} />
    </div>
  );
}
