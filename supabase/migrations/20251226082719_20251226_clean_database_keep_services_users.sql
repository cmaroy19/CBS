/*
  # Nettoyage de la base de données (garde services et users)

  1. Données supprimées
    - Toutes les transactions (transaction_headers, transaction_lines, transactions)
    - Tous les approvisionnements
    - Toutes les opérations de change
    - Tous les taux de change (exchange_rates)
    - Toutes les commissions quotidiennes (commissions_journalieres)
    - Toutes les clôtures de service quotidiennes (clotures_journalieres)
    - Logs d'audit (audit_logs)
    
  2. Données conservées
    - Services (avec remise à zéro des soldes virtuels)
    - Utilisateurs (users)
    - Global balances (avec remise à zéro)
    - Structure de la base (tables, vues, fonctions, triggers)
*/

-- Désactiver temporairement les triggers pour éviter les problèmes de cascade
SET session_replication_role = replica;

-- Supprimer toutes les lignes de transactions
DELETE FROM transaction_lines;

-- Supprimer tous les en-têtes de transactions
DELETE FROM transaction_headers;

-- Supprimer toutes les anciennes transactions (si elles existent encore)
DELETE FROM transactions;

-- Supprimer tous les approvisionnements
DELETE FROM approvisionnements;

-- Supprimer toutes les opérations de change
DELETE FROM change_operations;

-- Supprimer tous les taux de change
DELETE FROM exchange_rates;

-- Supprimer toutes les commissions quotidiennes
DELETE FROM commissions_journalieres;

-- Supprimer toutes les clôtures de service
DELETE FROM clotures_journalieres;

-- Supprimer les logs d'audit
DELETE FROM audit_logs;

-- Remettre à zéro tous les soldes virtuels des services
UPDATE services 
SET 
  solde_virtuel_usd = 0,
  solde_virtuel_cdf = 0
WHERE id IS NOT NULL;

-- Remettre à zéro les soldes globaux de cash
UPDATE global_balances
SET
  cash_usd = 0,
  cash_cdf = 0,
  updated_at = now()
WHERE id IS NOT NULL;

-- Réactiver les triggers
SET session_replication_role = DEFAULT;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Base de données nettoyée avec succès. Services et utilisateurs conservés. Tous les soldes remis à zéro.';
END $$;
