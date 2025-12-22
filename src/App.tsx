import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/ui/Toast';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Services } from './pages/Services';
import { Transactions } from './pages/Transactions';
import { Approvisionnements } from './pages/Approvisionnements';
import { Change } from './pages/Change';
import { TauxChange } from './pages/TauxChange';
import { Commissions } from './pages/Commissions';
import { Rapports } from './pages/Rapports';
import { Profil } from './pages/Profil';
import { Utilisateurs } from './pages/Utilisateurs';

function App() {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const initialize = useAuthStore(state => state.initialize);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-white">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'services':
        return <Services />;
      case 'transactions':
        return <Transactions />;
      case 'approvisionnements':
        return <Approvisionnements />;
      case 'change':
        return <Change />;
      case 'taux-change':
        return <TauxChange />;
      case 'commissions':
        return <Commissions />;
      case 'rapports':
        return <Rapports />;
      case 'profil':
        return <Profil />;
      case 'utilisateurs':
        return <Utilisateurs />;
      default:
        return <Dashboard />;
    }
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  return (
    <ErrorBoundary>
      <ToastContainer />
      <Layout currentPage={currentPage} onNavigate={handleNavigate}>
        {renderPage()}
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
