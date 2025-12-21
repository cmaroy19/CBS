import { supabase } from './supabase';
import type { ExchangeRate, Devise } from '../types';

interface CreateExchangeRateParams {
  devise_source: Devise;
  devise_destination: Devise;
  taux: number;
  actif?: boolean;
  date_debut?: string;
  date_fin?: string | null;
  notes?: string;
}

interface UpdateExchangeRateParams {
  taux?: number;
  actif?: boolean;
  date_fin?: string | null;
  notes?: string;
}

export class ExchangeRateService {
  static async getActiveRate(
    deviseSource: Devise,
    deviseDestination: Devise
  ): Promise<{ taux: number | null; error: Error | null }> {
    try {
      if (deviseSource === deviseDestination) {
        return { taux: 1, error: null };
      }

      const { data, error } = await supabase.rpc('get_active_exchange_rate', {
        p_devise_source: deviseSource,
        p_devise_destination: deviseDestination,
      });

      if (error) {
        return { taux: null, error };
      }

      return { taux: data, error: null };
    } catch (error) {
      return {
        taux: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async createRate(
    params: CreateExchangeRateParams
  ): Promise<{ data: ExchangeRate | null; error: Error | null }> {
    try {
      if (params.devise_source === params.devise_destination) {
        return {
          data: null,
          error: new Error('Les devises source et destination doivent être différentes'),
        };
      }

      if (params.taux <= 0) {
        return {
          data: null,
          error: new Error('Le taux doit être positif'),
        };
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return { data: null, error: new Error('Utilisateur non authentifié') };
      }

      const { data, error } = await supabase
        .from('exchange_rates')
        .insert({
          ...params,
          actif: params.actif !== undefined ? params.actif : true,
          date_debut: params.date_debut || new Date().toISOString(),
          created_by: user.user.id,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data as ExchangeRate, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async updateRate(
    rateId: string,
    updates: UpdateExchangeRateParams
  ): Promise<{ data: ExchangeRate | null; error: Error | null }> {
    try {
      if (updates.taux !== undefined && updates.taux <= 0) {
        return {
          data: null,
          error: new Error('Le taux doit être positif'),
        };
      }

      const { data, error } = await supabase
        .from('exchange_rates')
        .update(updates)
        .eq('id', rateId)
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data as ExchangeRate, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async deactivateRate(
    rateId: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .update({ actif: false, date_fin: new Date().toISOString() })
        .eq('id', rateId);

      if (error) {
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async activateRate(
    rateId: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .update({ actif: true, date_fin: null })
        .eq('id', rateId);

      if (error) {
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async listRates(filters?: {
    actif?: boolean;
    devise_source?: Devise;
    devise_destination?: Devise;
  }): Promise<{ data: ExchangeRate[] | null; error: Error | null }> {
    try {
      let query = supabase
        .from('exchange_rates')
        .select('*')
        .order('date_debut', { ascending: false });

      if (filters?.actif !== undefined) {
        query = query.eq('actif', filters.actif);
      }

      if (filters?.devise_source) {
        query = query.eq('devise_source', filters.devise_source);
      }

      if (filters?.devise_destination) {
        query = query.eq('devise_destination', filters.devise_destination);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      return { data: (data || []) as ExchangeRate[], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async getActiveRates(): Promise<{
    data: ExchangeRate[] | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('v_active_exchange_rates')
        .select('*');

      if (error) {
        return { data: null, error };
      }

      return { data: (data || []) as ExchangeRate[], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async getRateHistory(
    deviseSource: Devise,
    deviseDestination: Devise
  ): Promise<{ data: ExchangeRate[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('devise_source', deviseSource)
        .eq('devise_destination', deviseDestination)
        .order('date_debut', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      return { data: (data || []) as ExchangeRate[], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static formatPaireDevises(
    deviseSource: Devise,
    deviseDestination: Devise
  ): string {
    return `${deviseSource}/${deviseDestination}`;
  }

  static parsePaireDevises(paire: string): {
    source: Devise | null;
    destination: Devise | null;
  } {
    const [source, destination] = paire.split('/');
    if (
      !source ||
      !destination ||
      !['USD', 'CDF'].includes(source) ||
      !['USD', 'CDF'].includes(destination)
    ) {
      return { source: null, destination: null };
    }
    return { source: source as Devise, destination: destination as Devise };
  }

  static calculateConversion(
    montant: number,
    taux: number,
    deviseSource: Devise,
    deviseDestination: Devise
  ): number {
    if (deviseSource === deviseDestination) {
      return montant;
    }
    return montant * taux;
  }

  static async getTauxForTransaction(
    deviseSource: Devise,
    deviseDestination: Devise
  ): Promise<{
    taux: number | null;
    paire: string | null;
    error: Error | null;
  }> {
    if (deviseSource === deviseDestination) {
      return { taux: 1, paire: null, error: null };
    }

    const { taux, error } = await this.getActiveRate(
      deviseSource,
      deviseDestination
    );

    if (error || taux === null) {
      return { taux: null, paire: null, error };
    }

    const paire = this.formatPaireDevises(deviseSource, deviseDestination);
    return { taux, paire, error: null };
  }
}

export const exchangeRateService = ExchangeRateService;
