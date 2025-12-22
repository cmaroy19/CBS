import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import { Modal } from '../components/ui/Modal';
import { Plus, Calendar, Search, X } from 'lucide-react';
import { TransactionsForm } from '../components/transactions/TransactionsForm';
import { TransactionsTable } from '../components/transactions/TransactionsTable';
import type { Transaction } from '../types';

const ITEMS_PER_PAGE = 20;

export function Transactions() {
  const services = useDataStore(state => state.services);
  const setServices = useDataStore(state => state.setServices);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  const [searchReference, setSearchReference] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const loadData = async (page = 1, date = selectedDate, reference = searchReference) => {
    setLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let transactionsQuery = supabase
        .from('transactions')
        .select('*, service:services(*), creator:users(*)');

      let countQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      if (reference.trim()) {
        transactionsQuery = transactionsQuery.ilike('reference', `%${reference.trim()}%`);
        countQuery = countQuery.ilike('reference', `%${reference.trim()}%`);
      } else {
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        transactionsQuery = transactionsQuery
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay);
        countQuery = countQuery
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay);
      }

      const [transactionsRes, countRes, servicesRes] = await Promise.all([
        transactionsQuery
          .order('created_at', { ascending: false })
          .range(from, to),
        countQuery,
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
    if (!isSearching) {
      loadData(1, selectedDate, '');
      setCurrentPage(1);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (hasLoadedRef.current && !isSearching) {
      loadData(currentPage, selectedDate, '');
    }
  }, [currentPage]);

  const handleSearch = () => {
    if (searchReference.trim()) {
      setIsSearching(true);
      loadData(1, selectedDate, searchReference);
      setCurrentPage(1);
    }
  };

  const handleClearSearch = () => {
    setSearchReference('');
    setIsSearching(false);
    loadData(1, selectedDate, '');
    setCurrentPage(1);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    if (isSearching) {
      loadData(currentPage, selectedDate, searchReference);
    } else {
      loadData(currentPage, selectedDate, '');
    }
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-slate-600" />
            <label className="text-sm font-medium text-slate-700">Date :</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isSearching}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-slate-600">
              {totalCount} transaction{totalCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <Search className="w-5 h-5 text-slate-600" />
            <input
              type="text"
              value={searchReference}
              onChange={(e) => setSearchReference(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="Rechercher par référence..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {isSearching ? (
              <button
                onClick={handleClearSearch}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Effacer</span>
              </button>
            ) : (
              <button
                onClick={handleSearch}
                disabled={!searchReference.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className="w-4 h-4" />
                <span>Chercher</span>
              </button>
            )}
          </div>
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
