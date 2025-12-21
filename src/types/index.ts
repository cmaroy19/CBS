export type UserRole = 'administrateur' | 'proprietaire' | 'gerant' | 'caissier';
export type Devise = 'USD' | 'CDF';
export type TransactionType = 'depot' | 'retrait';
export type ApproType = 'cash' | 'virtuel';
export type ApproOperation = 'entree' | 'sortie';
export type ChangeSens = 'usd_to_cdf' | 'cdf_to_usd';
export type TypeOperation = 'depot' | 'retrait' | 'approvisionnement' | 'change' | 'transfert';
export type TypePortefeuille = 'cash' | 'virtuel';
export type SensEcriture = 'debit' | 'credit';
export type StatutTransaction = 'brouillon' | 'validee' | 'annulee';

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
  commission: number;
  reference: string;
  info_client: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
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

export interface TransactionHeader {
  id: string;
  reference: string;
  type_operation: TypeOperation;
  devise_reference: Devise;
  montant_total: number;
  description: string | null;
  info_client: string | null;
  statut: StatutTransaction;
  created_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: User;
  validator?: User;
  lines?: TransactionLine[];
}

export interface TransactionLine {
  id: string;
  header_id: string;
  ligne_numero: number;
  type_portefeuille: TypePortefeuille;
  service_id: string | null;
  devise: Devise;
  sens: SensEcriture;
  montant: number;
  description: string | null;
  created_at: string;
  service?: Service;
  header?: TransactionHeader;
}

export interface TransactionComplete {
  header: TransactionHeader;
  lines: TransactionLine[];
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
