export type UserRole = 'administrateur' | 'proprietaire' | 'gerant' | 'caissier';
export type Devise = 'USD' | 'CDF';
export type TransactionType = 'depot' | 'retrait';
export type ApproType = 'cash' | 'virtuel';
export type ApproOperation = 'entree' | 'sortie';
export type ChangeSens = 'usd_to_cdf' | 'cdf_to_usd';

export interface User {
  id: string;
  email: string;
  nom_complet: string;
  role: UserRole;
  photo_url: string | null;
  actif: boolean;
  age: number | null;
  last_login_at: string | null;
  last_login: string | null;
  suspended: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  nom: string;
  code: string;
  solde_virtuel_usd: number;
  solde_virtuel_cdf: number;
  type_compte: 'cash' | 'virtuel';
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  service_id: string;
  montant: number;
  devise: Devise;
  reference: string;
  info_client: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  annule?: boolean;
  transaction_origine_id?: string | null;
  raison_correction?: string | null;
  corrigee_par?: string | null;
  corrigee_le?: string | null;
  service?: Service;
  creator?: User;
}

export interface Approvisionnement {
  id: string;
  type: ApproType;
  operation: ApproOperation;
  service_id: string | null;
  montant: number;
  devise: Devise;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  service?: Service;
  creator?: User;
}

export interface ChangeOperation {
  id: string;
  montant_usd: number;
  montant_cdf: number;
  taux: number;
  commission: number;
  sens: ChangeSens;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  creator?: User;
}

export interface GlobalBalance {
  cash_usd: number;
  cash_cdf: number;
}

export interface RealtimeBalance {
  cash_usd: number | null;
  cash_cdf: number | null;
  total_virtuel_usd: number | null;
  total_virtuel_cdf: number | null;
}

export interface CommissionJournaliere {
  id: string;
  date_cloture: string;
  commission_usd: number;
  commission_cdf: number;
  service_id: string | null;
  notes: string | null;
  saisie_par: string | null;
  created_at: string;
  updated_at: string;
  service?: Service;
  saisie_par_user?: User;
}

export interface ExchangeRate {
  id: string;
  devise_source: Devise;
  devise_destination: Devise;
  taux: number;
  actif: boolean;
  date_debut: string;
  date_fin: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionMixtePayload {
  montant_usd_cash: number;
  montant_cdf_cash: number;
  taux_utilise: number;
}
