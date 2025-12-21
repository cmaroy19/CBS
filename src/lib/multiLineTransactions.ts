import { supabase } from './supabase';
import type {
  TransactionHeader,
  TransactionLine,
  TransactionComplete,
  TypeOperation,
  Devise,
  TypePortefeuille,
  SensEcriture,
  StatutTransaction,
} from '../types';

interface CreateTransactionHeaderParams {
  type_operation: TypeOperation;
  devise_reference: Devise;
  montant_total: number;
  description?: string;
  info_client?: string;
  taux_change?: number;
  paire_devises?: string;
}

interface CreateTransactionLineParams {
  ligne_numero: number;
  type_portefeuille: TypePortefeuille;
  service_id?: string;
  devise: Devise;
  sens: SensEcriture;
  montant: number;
  description?: string;
}

export class MultiLineTransactionService {
  static async createTransaction(
    headerParams: CreateTransactionHeaderParams,
    lines: CreateTransactionLineParams[]
  ): Promise<{ data: TransactionComplete | null; error: Error | null }> {
    try {
      if (lines.length < 2) {
        return {
          data: null,
          error: new Error('Une transaction doit avoir au moins 2 lignes'),
        };
      }

      const balanceError = this.validateBalance(lines);
      if (balanceError) {
        return { data: null, error: balanceError };
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return { data: null, error: new Error('Utilisateur non authentifié') };
      }

      const { data: header, error: headerError } = await supabase
        .from('transaction_headers')
        .insert({
          ...headerParams,
          statut: 'brouillon',
          created_by: user.user.id,
        })
        .select()
        .single();

      if (headerError || !header) {
        return { data: null, error: headerError || new Error('Erreur lors de la création de l\'en-tête') };
      }

      const linesWithHeaderId = lines.map((line) => ({
        ...line,
        header_id: header.id,
      }));

      const { data: createdLines, error: linesError } = await supabase
        .from('transaction_lines')
        .insert(linesWithHeaderId)
        .select();

      if (linesError || !createdLines) {
        await supabase.from('transaction_headers').delete().eq('id', header.id);
        return { data: null, error: linesError || new Error('Erreur lors de la création des lignes') };
      }

      return {
        data: {
          header: header as TransactionHeader,
          lines: createdLines as TransactionLine[],
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async validateTransaction(
    headerId: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('transaction_headers')
        .update({ statut: 'validee' as StatutTransaction })
        .eq('id', headerId)
        .eq('statut', 'brouillon');

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

  static async cancelTransaction(
    headerId: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('transaction_headers')
        .update({ statut: 'annulee' as StatutTransaction })
        .eq('id', headerId);

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

  static async getTransaction(
    headerId: string
  ): Promise<{ data: TransactionComplete | null; error: Error | null }> {
    try {
      const { data: header, error: headerError } = await supabase
        .from('transaction_headers')
        .select('*')
        .eq('id', headerId)
        .single();

      if (headerError || !header) {
        return { data: null, error: headerError || new Error('Transaction non trouvée') };
      }

      const { data: lines, error: linesError } = await supabase
        .from('transaction_lines')
        .select('*, service:services(*)')
        .eq('header_id', headerId)
        .order('ligne_numero');

      if (linesError) {
        return { data: null, error: linesError };
      }

      return {
        data: {
          header: header as TransactionHeader,
          lines: (lines || []) as TransactionLine[],
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async listTransactions(
    filters?: {
      statut?: StatutTransaction;
      type_operation?: TypeOperation;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ data: TransactionHeader[] | null; error: Error | null }> {
    try {
      let query = supabase
        .from('transaction_headers')
        .select('*, creator:users!created_by(*), validator:users!validated_by(*)')
        .order('created_at', { ascending: false });

      if (filters?.statut) {
        query = query.eq('statut', filters.statut);
      }

      if (filters?.type_operation) {
        query = query.eq('type_operation', filters.type_operation);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      return { data: (data || []) as TransactionHeader[], error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static validateBalance(lines: CreateTransactionLineParams[]): Error | null {
    const devises = [...new Set(lines.map((l) => l.devise))];

    for (const devise of devises) {
      const deviseLines = lines.filter((l) => l.devise === devise);
      const totalDebit = deviseLines
        .filter((l) => l.sens === 'debit')
        .reduce((sum, l) => sum + l.montant, 0);
      const totalCredit = deviseLines
        .filter((l) => l.sens === 'credit')
        .reduce((sum, l) => sum + l.montant, 0);

      const difference = Math.abs(totalDebit - totalCredit);
      if (difference > 0.01) {
        return new Error(
          `Transaction non équilibrée pour ${devise}: débit = ${totalDebit}, crédit = ${totalCredit}`
        );
      }
    }

    return null;
  }

  static async addLine(
    headerId: string,
    line: CreateTransactionLineParams
  ): Promise<{ data: TransactionLine | null; error: Error | null }> {
    try {
      const { data: header } = await supabase
        .from('transaction_headers')
        .select('statut')
        .eq('id', headerId)
        .single();

      if (!header || header.statut !== 'brouillon') {
        return {
          data: null,
          error: new Error('Impossible d\'ajouter une ligne à une transaction validée ou annulée'),
        };
      }

      const { data, error } = await supabase
        .from('transaction_lines')
        .insert({
          ...line,
          header_id: headerId,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data as TransactionLine, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async updateLine(
    lineId: string,
    updates: Partial<CreateTransactionLineParams>
  ): Promise<{ data: TransactionLine | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('transaction_lines')
        .update(updates)
        .eq('id', lineId)
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data as TransactionLine, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Erreur inconnue'),
      };
    }
  }

  static async deleteLine(
    lineId: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('transaction_lines')
        .delete()
        .eq('id', lineId);

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
}

export const multiLineTransactionService = MultiLineTransactionService;
