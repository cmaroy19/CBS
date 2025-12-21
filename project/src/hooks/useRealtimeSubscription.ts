import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';

export function useRealtimeSubscription() {
  const { setServices, setTransactions, setApprovisionnements, setChangeOperations } = useDataStore();

  useEffect(() => {
    const servicesChannel = supabase
      .channel('services-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services',
        },
        async () => {
          const { data } = await supabase
            .from('services')
            .select('*')
            .order('created_at', { ascending: false });

          if (data) {
            setServices(data);
          }
        }
      )
      .subscribe();

    const transactionsChannel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        async () => {
          const { data } = await supabase
            .from('transactions')
            .select('*, service:services(*), creator:users(*)')
            .order('created_at', { ascending: false })
            .limit(100);

          if (data) {
            setTransactions(data as any);
          }
        }
      )
      .subscribe();

    const approvisionnementsChannel = supabase
      .channel('approvisionnements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approvisionnements',
        },
        async () => {
          const { data } = await supabase
            .from('approvisionnements')
            .select('*, service:services(*), creator:users(*)')
            .order('created_at', { ascending: false })
            .limit(100);

          if (data) {
            setApprovisionnements(data as any);
          }
        }
      )
      .subscribe();

    const changeChannel = supabase
      .channel('change-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'change_operations',
        },
        async () => {
          const { data } = await supabase
            .from('change_operations')
            .select('*, creator:users(*)')
            .order('created_at', { ascending: false })
            .limit(100);

          if (data) {
            setChangeOperations(data as any);
          }
        }
      )
      .subscribe();

    return () => {
      servicesChannel.unsubscribe();
      transactionsChannel.unsubscribe();
      approvisionnementsChannel.unsubscribe();
      changeChannel.unsubscribe();
    };
  }, [setServices, setTransactions, setApprovisionnements, setChangeOperations]);
}
