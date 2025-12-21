export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          nom_complet: string
          role: 'proprietaire' | 'gerant' | 'caissier'
          photo_url: string | null
          actif: boolean
          age: number | null
          last_login_at: string | null
          suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          nom_complet: string
          role: 'proprietaire' | 'gerant' | 'caissier'
          photo_url?: string | null
          actif?: boolean
          age?: number | null
          last_login_at?: string | null
          suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          nom_complet?: string
          role?: 'proprietaire' | 'gerant' | 'caissier'
          photo_url?: string | null
          actif?: boolean
          age?: number | null
          last_login_at?: string | null
          suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          nom: string
          code: string
          solde_virtuel_usd: number
          solde_virtuel_cdf: number
          actif: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nom: string
          code: string
          solde_virtuel_usd?: number
          solde_virtuel_cdf?: number
          actif?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nom?: string
          code?: string
          solde_virtuel_usd?: number
          solde_virtuel_cdf?: number
          actif?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          type: 'depot' | 'retrait'
          service_id: string
          montant: number
          devise: 'USD' | 'CDF'
          commission: number
          reference: string
          info_client: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: 'depot' | 'retrait'
          service_id: string
          montant: number
          devise: 'USD' | 'CDF'
          commission?: number
          reference: string
          info_client?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: 'depot' | 'retrait'
          service_id?: string
          montant?: number
          devise?: 'USD' | 'CDF'
          commission?: number
          reference?: string
          info_client?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      approvisionnements: {
        Row: {
          id: string
          type: 'cash' | 'virtuel'
          operation: 'entree' | 'sortie'
          service_id: string | null
          montant: number
          devise: 'USD' | 'CDF'
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: 'cash' | 'virtuel'
          operation: 'entree' | 'sortie'
          service_id?: string | null
          montant: number
          devise: 'USD' | 'CDF'
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: 'cash' | 'virtuel'
          operation?: 'entree' | 'sortie'
          service_id?: string | null
          montant?: number
          devise?: 'USD' | 'CDF'
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      change_operations: {
        Row: {
          id: string
          montant_usd: number
          montant_cdf: number
          taux: number
          commission: number
          sens: 'usd_to_cdf' | 'cdf_to_usd'
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          montant_usd: number
          montant_cdf: number
          taux: number
          commission?: number
          sens: 'usd_to_cdf' | 'cdf_to_usd'
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          montant_usd?: number
          montant_cdf?: number
          taux?: number
          commission?: number
          sens?: 'usd_to_cdf' | 'cdf_to_usd'
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      global_balances: {
        Row: {
          id: string
          cash_usd: number
          cash_cdf: number
          updated_at: string
        }
        Insert: {
          id?: string
          cash_usd?: number
          cash_cdf?: number
          updated_at?: string
        }
        Update: {
          id?: string
          cash_usd?: number
          cash_cdf?: number
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          operation: 'INSERT' | 'UPDATE' | 'DELETE'
          record_id: string
          old_data: Json | null
          new_data: Json | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          operation: 'INSERT' | 'UPDATE' | 'DELETE'
          record_id: string
          old_data?: Json | null
          new_data?: Json | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          operation?: 'INSERT' | 'UPDATE' | 'DELETE'
          record_id?: string
          old_data?: Json | null
          new_data?: Json | null
          user_id?: string | null
          created_at?: string
        }
      }
      exchange_rates: {
        Row: {
          id: string
          devise_source: 'USD' | 'CDF'
          devise_destination: 'USD' | 'CDF'
          taux: number
          actif: boolean
          date_debut: string
          date_fin: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          devise_source: 'USD' | 'CDF'
          devise_destination: 'USD' | 'CDF'
          taux: number
          actif?: boolean
          date_debut?: string
          date_fin?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          devise_source?: 'USD' | 'CDF'
          devise_destination?: 'USD' | 'CDF'
          taux?: number
          actif?: boolean
          date_debut?: string
          date_fin?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transaction_headers: {
        Row: {
          id: string
          reference: string
          type_operation: 'depot' | 'retrait' | 'approvisionnement' | 'change' | 'transfert'
          devise_reference: 'USD' | 'CDF'
          montant_total: number
          description: string | null
          info_client: string | null
          taux_change: number | null
          paire_devises: string | null
          statut: 'brouillon' | 'validee' | 'annulee'
          created_by: string | null
          validated_by: string | null
          validated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reference: string
          type_operation: 'depot' | 'retrait' | 'approvisionnement' | 'change' | 'transfert'
          devise_reference: 'USD' | 'CDF'
          montant_total: number
          description?: string | null
          info_client?: string | null
          taux_change?: number | null
          paire_devises?: string | null
          statut?: 'brouillon' | 'validee' | 'annulee'
          created_by?: string | null
          validated_by?: string | null
          validated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reference?: string
          type_operation?: 'depot' | 'retrait' | 'approvisionnement' | 'change' | 'transfert'
          devise_reference?: 'USD' | 'CDF'
          montant_total?: number
          description?: string | null
          info_client?: string | null
          taux_change?: number | null
          paire_devises?: string | null
          statut?: 'brouillon' | 'validee' | 'annulee'
          created_by?: string | null
          validated_by?: string | null
          validated_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transaction_lines: {
        Row: {
          id: string
          header_id: string
          ligne_numero: number
          type_portefeuille: 'cash' | 'virtuel'
          service_id: string | null
          devise: 'USD' | 'CDF'
          sens: 'debit' | 'credit'
          montant: number
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          header_id: string
          ligne_numero: number
          type_portefeuille: 'cash' | 'virtuel'
          service_id?: string | null
          devise: 'USD' | 'CDF'
          sens: 'debit' | 'credit'
          montant: number
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          header_id?: string
          ligne_numero?: number
          type_portefeuille?: 'cash' | 'virtuel'
          service_id?: string | null
          devise?: 'USD' | 'CDF'
          sens?: 'debit' | 'credit'
          montant?: number
          description?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      realtime_balances: {
        Row: {
          cash_usd: number | null
          cash_cdf: number | null
          total_virtuel_usd: number | null
          total_virtuel_cdf: number | null
        }
      }
      v_active_exchange_rates: {
        Row: {
          id: string
          devise_source: 'USD' | 'CDF'
          devise_destination: 'USD' | 'CDF'
          taux: number
          date_debut: string
          date_fin: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
      }
      v_transactions_completes: {
        Row: {
          id: string
          reference: string
          type_operation: 'depot' | 'retrait' | 'approvisionnement' | 'change' | 'transfert'
          devise_reference: 'USD' | 'CDF'
          montant_total: number
          description: string | null
          info_client: string | null
          taux_change: number | null
          paire_devises: string | null
          statut: 'brouillon' | 'validee' | 'annulee'
          created_by: string | null
          validated_by: string | null
          validated_at: string | null
          created_at: string
          updated_at: string
          lines: Json | null
        }
      }
    }
  }
}
