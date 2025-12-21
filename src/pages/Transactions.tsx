import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import { Modal } from '../components/ui/Modal';
import { Plus, Calendar } from 'lucide-react';
import { TransactionsForm } from '../components/transactions/TransactionsForm';
import { TransactionsTable } from '../components/transactions/TransactionsTable';
import type { TransactionHeader } from '../types';

const ITEMS_PER_PAGE = 20;

export function Transactions() {
  const services = useDataStore(state => state.services);
  const setServices = useDataStore(state => state.setServices);
  const [transactions, setTransactions] = useState<TransactionHeader[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const hasLoadedRef = useRef(false);

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(formatDateForInput(new Date()));

  const loadData = async (page = 1, date = selectedDate) => {
    setLoading(true);
    try {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const [transactionsRes, countRes, servicesRes] = await Promise.all([
        supabase
          .from('transaction_headers')
          .select(`
            *,
            creator:users!transaction_headers_created_by_fkey(*),
            validator:users!transaction_headers_validated_by_fkey(*),
            lines:transaction_lines(
              *,
              service:services(*)
            )
          `)
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('transaction_headers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),
        hasLoadedRef.current
          ? Promise.resolve({ data: null })
          : supabase
              .from('services')
              .select('*')
              .eq('actif', true)
              .order('nom'),
      ]);

      if (transactionsRes.data) {
        setTransactions(transactionsRes.data as any);
      }

      if (countRes.count !== null) {
        setTotalCount(countRes.count);
      }

      if (servicesRes.data) {
        setServices(servicesRes.data);
      }

      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, selectedDate);
    setCurrentPage(1);
  }, [selectedDate]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      loadData(currentPage, selectedDate);
    }
  }, [currentPage]);

  // Realtime géré par useOptimizedRealtime() dans App.tsx

  const handleSuccess = () => {
    setIsModalOpen(false);
    loadData(currentPage, selectedDate);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="text-slate-600">Chargement des transactions...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Transactions</h1>
          <p className="text-slate-600">Gestion des dépôts et retraits</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvelle transaction</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-slate-600" />
          <label className="text-sm font-medium text-slate-700">Date :</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <span className="text-sm text-slate-600">
            {totalCount} transaction{totalCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <TransactionsTable transactions={transactions} loading={loading} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Précédent
          </button>
          <span className="text-sm text-slate-600">
            Page {currentPage} sur {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
          </button>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCancel}
        title="Nouvelle transaction"
        size="lg"
      >
        <TransactionsForm
          services={services}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </Modal>
    </div>
  );
}
