import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

let globalChannel: RealtimeChannel | null = null;
let isSubscribed = false;

export function useOptimizedRealtime() {
  const setServices = useDataStore(state => state.setServices);
  const setTransactions = useDataStore(state => state.setTransactions);
  const setApprovisionnements = useDataStore(state => state.setApprovisionnements);
  const setChangeOperations = useDataStore(state => state.setChangeOperations);

  useEffect(() => {
    if (globalChannel && isSubscribed) {
      return;
    }

    if (!globalChannel) {
      console.log('🔌 Initialisation canal Realtime (singleton)...');

      globalChannel = supabase
        .channel('app-realtime-singleton')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
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
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
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
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transaction_headers',
          },
          async () => {
            const [txRes, servicesRes] = await Promise.all([
              supabase
                .from('transaction_headers')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100),
              supabase
                .from('services')
                .select('*')
                .order('created_at', { ascending: false })
            ]);

            if (txRes.data) {
              setTransactions(txRes.data as any);
            }

            if (servicesRes.data) {
              setServices(servicesRes.data);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transaction_headers',
          },
          async () => {
            const [txRes, servicesRes] = await Promise.all([
              supabase
                .from('transaction_headers')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100),
              supabase
                .from('services')
                .select('*')
                .order('created_at', { ascending: false })
            ]);

            if (txRes.data) {
              setTransactions(txRes.data as any);
            }

            if (servicesRes.data) {
              setServices(servicesRes.data);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'approvisionnements',
          },
          async () => {
            const [approsRes, servicesRes] = await Promise.all([
              supabase
                .from('approvisionnements')
                .select('*, service:services(*), creator:users(*)')
                .order('created_at', { ascending: false })
                .limit(100),
              supabase
                .from('services')
                .select('*')
                .order('created_at', { ascending: false })
            ]);

            if (approsRes.data) {
              setApprovisionnements(approsRes.data as any);
            }

            if (servicesRes.data) {
              setServices(servicesRes.data);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'global_balances',
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
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
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
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            console.log('✅ Canal Realtime activé (singleton global)');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Erreur canal realtime');
            isSubscribed = false;
          } else if (status === 'CLOSED') {
            console.log('🔴 Canal realtime fermé');
            isSubscribed = false;
            globalChannel = null;
          }
        });
    }
  }, []);
}
