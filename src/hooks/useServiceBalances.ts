import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';

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

export function useServiceBalances() {
  const [serviceBalances, setServiceBalances] = useState<ServiceBalance[]>([]);
  const services = useDataStore(state => state.services);

  const loadServiceBalances = async () => {
    try {
      const { data, error } = await supabase
        .from('v_service_balances')
        .select('*');

      if (error) throw error;

      if (data) {
        setServiceBalances(data);
      }
    } catch (error) {
      console.error('Error loading service balances:', error);
    }
  };

  useEffect(() => {
    loadServiceBalances();
  }, []);

  useEffect(() => {
    loadServiceBalances();
  }, [services]);

  return serviceBalances;
}
