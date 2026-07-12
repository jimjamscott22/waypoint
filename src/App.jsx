import { useJobsStore } from './hooks/useJobsStore';

export default function App() {
  const store = useJobsStore();
  return (
    <pre style={{ padding: 40, fontSize: 12 }}>
      {JSON.stringify({ totalCount: store.totalCount, tabs: store.tabs, queueLen: store.queue.length }, null, 2)}
    </pre>
  );
}
