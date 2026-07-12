import Sidebar from './components/Sidebar';
import Header from './components/Header';

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1 }}>
        <Header />
      </main>
    </div>
  );
}
