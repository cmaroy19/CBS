/*
  # Réinitialisation de la base de données (garde les services)

  ## Ce qui sera supprimé
  - Toutes les transactions (transactions, transaction_headers, transaction_lines)
  - Tous les approvisionnements
  - Toutes les opérations de change
  - Toutes les commissions journalières
  - Toutes les clôtures de service journalières
  - Les logs d'audit
  
  ## Ce qui sera réinitialisé
  - Les soldes globaux (cash remis à 0)
  - Les soldes virtuels des services (remis à 0)
  
  ## Ce qui sera conservé
  - Les services et leurs informations
  - Les utilisateurs
  - Les taux de change
*/

-- Désactiver temporairement les triggers pour éviter les effets de bord
SET session_replication_role = 'replica';

-- Supprimer les données transactionnelles (ordre important à cause des foreign keys)
DELETE FROM transaction_lines;
DELETE FROM transaction_headers;
DELETE FROM transactions;
DELETE FROM approvisionnements;
DELETE FROM change_operations;
DELETE FROM commissions_journalieres;
DELETE FROM clotures_journalieres;
DELETE FROM audit_logs;

-- Réactiver les triggers
SET session_replication_role = 'origin';

-- Réinitialiser les soldes globaux
UPDATE global_balances
SET 
  cash_usd = 0,
  cash_cdf = 0,
  updated_at = now();

-- Réinitialiser les soldes virtuels des services
UPDATE services
SET 
  solde_virtuel_usd = 0,
  solde_virtuel_cdf = 0,
  updated_at = now();

-- Afficher un résumé
DO $$
DECLARE
  v_nb_services integer;
  v_nb_users integer;
  v_nb_rates integer;
BEGIN
  SELECT COUNT(*) INTO v_nb_services FROM services;
  SELECT COUNT(*) INTO v_nb_users FROM users;
  SELECT COUNT(*) INTO v_nb_rates FROM exchange_rates WHERE actif = true;
  
  RAISE NOTICE '=== BASE DE DONNÉES RÉINITIALISÉE ===';
  RAISE NOTICE 'Services conservés: %', v_nb_services;
  RAISE NOTICE 'Utilisateurs conservés: %', v_nb_users;
  RAISE NOTICE 'Taux de change actifs conservés: %', v_nb_rates;
  RAISE NOTICE 'Soldes globaux: 0 USD, 0 CDF';
  RAISE NOTICE 'Soldes services: tous à 0';
  RAISE NOTICE '=====================================';
END $$;
