import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import { useServiceBalances } from '../hooks/useServiceBalances';
import { CurrencySection } from '../components/dashboard/CurrencySection';
import { RecentTransactions } from '../components/dashboard/RecentTransactions';
import { AlertsPanel } from '../components/dashboard/AlertsPanel';
import { CommissionsOverview } from '../components/dashboard/CommissionsOverview';
import ServiceBalances from '../components/dashboard/ServiceBalances';
import { Activity, TrendingUp, Users, LayoutGrid, Building2 } from 'lucide-react';

type DashboardView = 'overview' | 'services';

interface DashboardStats {
  cash_usd: number;
  cash_cdf: number;
  virtual_usd: number;
  virtual_cdf: number;
  total_tresorerie_usd: number;
  total_tresorerie_cdf: number;
  transactions_today: number;
  approvisionnements_today: number;
  change_operations_today: number;
  commissions_today_usd: number;
  volume_today_usd: number;
  volume_today_cdf: number;
  services_actifs: number;
  users_actifs: number;
  updated_at: string;
}

interface RecentTransaction {
  id: string;
  reference: string;
  type_transaction: string;
  montant: number;
  devise: string;
  service_nom: string | null;
  info_client: string | null;
  created_at: string;
}

interface ServiceBalance {
  id: string;
  service_name: string;
  service_code: string;
  type_compte: 'cash' | 'virtuel';
  virtual_usd: number;
  virtual_cdf: number;
  is_active: boolean;
  last_updated: string;
}

export function Dashboard() {
  const services = useDataStore(state => state.services);
  const serviceBalances = useServiceBalances();
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadDashboardData = async () => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const startTime = performance.now();

    try {
      setLoading(true);
      setError('');

      const statsRes = await supabase
        .from('dashboard_stats_fast')
        .select('*')
        .maybeSingle();

      const loadTime = performance.now() - startTime;

      if (statsRes.data) {
        setStats(statsRes.data);
      }

      setLoading(false);

      supabase
        .from('transactions')
        .select(`
          id,
          reference,
          type,
          montant,
          devise,
          info_client,
          created_at,
          service:service_id(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(10)
        .then((res) => {
          if (res.data) {
            const formatted = res.data.map((t: any) => ({
              ...t,
              type_transaction: t.type,
              service_nom: t.service?.nom || null,
            }));
            setRecentTransactions(formatted);
          }
        })
        .catch(() => {});

    } catch (err: any) {
      if (services.length > 0) {
        const fallbackStats: DashboardStats = {
          cash_usd: 0,
          cash_cdf: 0,
          virtual_usd: services.reduce((sum, s) => sum + (s.solde_virtuel_usd || 0), 0),
          virtual_cdf: services.reduce((sum, s) => sum + (s.solde_virtuel_cdf || 0), 0),
          total_tresorerie_usd: services.reduce((sum, s) => sum + (s.solde_virtuel_usd || 0), 0),
          total_tresorerie_cdf: services.reduce((sum, s) => sum + (s.solde_virtuel_cdf || 0), 0),
          transactions_today: 0,
          approvisionnements_today: 0,
          change_operations_today: 0,
          commissions_today_usd: 0,
          volume_today_usd: 0,
          volume_today_cdf: 0,
          services_actifs: services.filter(s => s.actif).length,
          users_actifs: 0,
          updated_at: new Date().toISOString(),
        };
        setStats(fallbackStats);
        setLoading(false);
        setError('Mode hors ligne (données partielles)');
      } else {
        setError('Impossible de charger les données. Vérifiez votre connexion.');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Realtime géré par useOptimizedRealtime() dans App.tsx

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-semibold mb-2">Erreur</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={loadDashboardData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-600">Aucune donnée disponible</p>
      </div>
    );
  }

  const totalUSD = stats.cash_usd + stats.virtual_usd;
  const totalCDF = stats.cash_cdf + stats.virtual_cdf;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Tableau de bord</h1>
        <p className="text-slate-600">Vue d'ensemble en temps réel</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveView('overview')}
            className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
              activeView === 'overview'
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span>Vue d'ensemble</span>
          </button>
          <button
            onClick={() => setActiveView('services')}
            className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
              activeView === 'services'
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span>Détails par Service</span>
          </button>
        </div>
      </div>

      {activeView === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Transactions</h3>
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.transactions_today}</p>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Volume USD</span>
                  <span className="font-semibold text-slate-900">
                    {stats.volume_today_usd.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-600">Volume CDF</span>
                  <span className="font-semibold text-slate-900">
                    {stats.volume_today_cdf.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Activité</h3>
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.approvisionnements_today}</p>
              <p className="text-sm text-slate-500 mt-2">Approvisionnements</p>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-sm text-slate-600">{stats.change_operations_today} opérations de change</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Système</h3>
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.services_actifs}</p>
              <p className="text-sm text-slate-500 mt-2">Services actifs</p>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-sm text-slate-600">{stats.users_actifs} utilisateurs actifs</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CurrencySection
              currency="USD"
              cashBalance={stats.cash_usd}
              virtualBalance={stats.virtual_usd}
              commissions={stats.commissions_today_usd}
              totalGeneral={totalUSD}
            />

            <CurrencySection
              currency="CDF"
              cashBalance={stats.cash_cdf}
              virtualBalance={stats.virtual_cdf}
              commissions={0}
              totalGeneral={totalCDF}
            />
          </div>

          <AlertsPanel
            cashUsd={stats.cash_usd}
            cashCdf={stats.cash_cdf}
            minCashUsd={1000}
            minCashCdf={1000000}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CommissionsOverview />
            <RecentTransactions transactions={recentTransactions} />
          </div>
        </>
      )}

      {activeView === 'services' && (
        <>
          {serviceBalances.length > 0 && (
            <ServiceBalances services={serviceBalances} />
          )}
        </>
      )}
    </div>
  );
}
