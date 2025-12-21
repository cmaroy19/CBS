import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import type { Transaction, Approvisionnement, ChangeOperation } from '../types';

interface ReportFilters {
  startDate: string;
  endDate: string;
  serviceId?: string;
  currency?: string;
  operationType?: string;
}

interface ReportData {
  transactions: Transaction[];
  approvisionnements: Approvisionnement[];
  changeOperations: ChangeOperation[];
  loading: boolean;
  error: string | null;
}

export function useReportData(filters: ReportFilters): ReportData {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvisionnements, setApprovisionnements] = useState<Approvisionnement[]>([]);
  const [changeOperations, setChangeOperations] = useState<ChangeOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDateTime = `${filters.startDate}T00:00:00`;
      const endDateTime = `${filters.endDate}T23:59:59`;

      const shouldLoadTransactions =
        !filters.operationType ||
        filters.operationType === 'depot' ||
        filters.operationType === 'retrait';

      const shouldLoadAppros =
        !filters.operationType ||
        filters.operationType === 'approvisionnement';

      const shouldLoadChange =
        !filters.operationType ||
        filters.operationType === 'change';

      if (shouldLoadTransactions) {
        let transQuery = supabase
          .from('transactions')
          .select('*, service:services(*), creator:users(*)')
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime);

        if (filters.serviceId) {
          transQuery = transQuery.eq('service_id', filters.serviceId);
        }

        if (filters.currency) {
          transQuery = transQuery.eq('devise', filters.currency);
        }

        if (filters.operationType === 'depot' || filters.operationType === 'retrait') {
          transQuery = transQuery.eq('type', filters.operationType);
        }

        const { data: transData, error: transError } = await transQuery;

        if (transError) throw transError;
        setTransactions(transData || []);
      } else {
        setTransactions([]);
      }

      if (shouldLoadAppros) {
        let approQuery = supabase
          .from('approvisionnements')
          .select('*, service:services(*), creator:users(*)')
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime);

        if (filters.serviceId) {
          approQuery = approQuery.eq('service_id', filters.serviceId);
        }

        if (filters.currency) {
          approQuery = approQuery.eq('devise', filters.currency);
        }

        const { data: approData, error: approError } = await approQuery;

        if (approError) throw approError;
        setApprovisionnements(approData || []);
      } else {
        setApprovisionnements([]);
      }

      if (shouldLoadChange) {
        let changeQuery = supabase
          .from('change_operations')
          .select('*, creator:users(*)')
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime);

        const { data: changeData, error: changeError } = await changeQuery;

        if (changeError) throw changeError;
        setChangeOperations(changeData || []);
      } else {
        setChangeOperations([]);
      }
    } catch (err) {
      console.error('Error loading report data:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.startDate, filters.endDate, filters.serviceId, filters.currency, filters.operationType]);

  useRealtimeSubscription('transactions', loadData);
  useRealtimeSubscription('approvisionnements', loadData);
  useRealtimeSubscription('change_operations', loadData);

  return {
    transactions,
    approvisionnements,
    changeOperations,
    loading,
    error,
  };
}
