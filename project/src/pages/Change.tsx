import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Modal } from '../components/ui/Modal';
import { Plus, Calendar } from 'lucide-react';
import { ChangeForm } from '../components/change/ChangeForm';
import { ChangeHistory } from '../components/change/ChangeHistory';
import type { ChangeOperation } from '../types';

const ITEMS_PER_PAGE = 20;

export function Change() {
  const { user } = useAuthStore();
  const [changeOperations, setChangeOperations] = useState<ChangeOperation[]>([]);
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
  const canManage = user?.role === 'proprietaire' || user?.role === 'gerant';

  const loadData = async (page = 1, date = selectedDate) => {
    setLoading(true);
    try {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const [changeRes, countRes] = await Promise.all([
        supabase
          .from('change_operations')
          .select('*, creator:users(*)')
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('change_operations')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),
      ]);

      if (changeRes.data) {
        setChangeOperations(changeRes.data as any);
      }

      if (countRes.count !== null) {
        setTotalCount(countRes.count);
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
          <p className="text-slate-600">Chargement des opérations de change...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Change USD/CDF</h1>
          <p className="text-slate-600">Gestion des opérations de change</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle opération</span>
          </button>
        )}
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
            {totalCount} opération{totalCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <ChangeHistory operations={changeOperations} loading={loading} />

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
        title="Nouvelle opération de change"
        size="lg"
      >
        <ChangeForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </Modal>
    </div>
  );
}
