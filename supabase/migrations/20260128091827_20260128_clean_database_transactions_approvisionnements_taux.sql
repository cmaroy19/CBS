/*
  # Nettoyage des données transactionnelles
  
  1. Objectif
    - Vider les tables de transactions
    - Vider les tables d'approvisionnements
    - Vider les tables de taux de change
    - Préserver les utilisateurs et les services
  
  2. Tables nettoyées
    - `transaction_lines` : Lignes de détail des transactions
    - `transaction_headers` : En-têtes des transactions
    - `transactions` : Transactions simples (ancienne table)
    - `approvisionnements` : Approvisionnements de cash
    - `exchange_rates` : Taux de change configurables
    - `clotures_journalieres` : Clôtures journalières
    - `commissions_journalieres` : Commissions journalières
    - `change_operations` : Opérations de change
    - `audit_logs` : Logs d'audit
  
  3. Tables préservées
    - `users` : Utilisateurs du système
    - `services` : Services mobiles money
  
  4. Soldes réinitialisés
    - `services` : Soldes virtuels à 0
    - `global_balances` : Soldes cash à 0
  
  5. Important
    - Cette opération est IRREVERSIBLE
    - Toutes les données de transactions seront perdues
    - Les soldes seront réinitialisés à 0
*/

-- Désactiver temporairement les triggers pour éviter les effets de bord
SET session_replication_role = 'replica';

-- 1. Supprimer toutes les lignes de transactions
DELETE FROM transaction_lines;

-- 2. Supprimer tous les en-têtes de transactions
DELETE FROM transaction_headers;

-- 3. Supprimer toutes les transactions simples (ancienne table)
DELETE FROM transactions;

-- 4. Supprimer tous les approvisionnements
DELETE FROM approvisionnements;

-- 5. Supprimer tous les taux de change
DELETE FROM exchange_rates;

-- 6. Supprimer toutes les clôtures journalières
DELETE FROM clotures_journalieres;

-- 7. Supprimer toutes les commissions journalières
DELETE FROM commissions_journalieres;

-- 8. Supprimer toutes les opérations de change
DELETE FROM change_operations;

-- 9. Supprimer tous les logs d'audit
DELETE FROM audit_logs;

-- 10. Réinitialiser les soldes des services à 0
UPDATE services 
SET 
  solde_virtuel_usd = 0,
  solde_virtuel_cdf = 0,
  updated_at = now();

-- 11. Réinitialiser les soldes cash globaux à 0
UPDATE global_balances 
SET 
  cash_usd = 0,
  cash_cdf = 0,
  updated_at = now();

-- Réactiver les triggers
SET session_replication_role = 'origin';

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'BASE DE DONNÉES NETTOYÉE AVEC SUCCÈS';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Transactions supprimées : transaction_lines, transaction_headers, transactions';
  RAISE NOTICE 'Approvisionnements supprimés : approvisionnements';
  RAISE NOTICE 'Taux de change supprimés : exchange_rates';
  RAISE NOTICE 'Clôtures et commissions supprimées : clotures_journalieres, commissions_journalieres';
  RAISE NOTICE 'Opérations de change supprimées : change_operations';
  RAISE NOTICE 'Logs d''audit supprimés : audit_logs';
  RAISE NOTICE 'Soldes réinitialisés : services (virtuels) et global_balances (cash)';
  RAISE NOTICE '================================================';
END $$;
