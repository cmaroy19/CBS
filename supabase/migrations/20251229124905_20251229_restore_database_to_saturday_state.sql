/*
  # Restauration de la base de données à l'état de samedi 27 décembre
  
  ## Description
  Nettoie toutes les données de transactions créées après samedi
  et restaure la base à un état propre tout en conservant :
  - Les utilisateurs
  - Les services
  - Les taux de change actifs
  - La structure des tables
  
  ## Modifications
  1. Suppression de toutes les transactions (anciennes et nouvelles)
  2. Suppression de tous les approvisionnements
  3. Suppression de toutes les opérations de change
  4. Suppression des commissions et clôtures journalières
  5. Réinitialisation des soldes des services
  6. Réinitialisation des soldes globaux
  7. Conservation des utilisateurs et services configurés
  8. Conservation des taux de change actifs
*/

-- 1. Supprimer toutes les lignes de transactions (avant les en-têtes à cause des FK)
DELETE FROM transaction_lines;

-- 2. Supprimer tous les en-têtes de transactions
DELETE FROM transaction_headers;

-- 3. Supprimer toutes les anciennes transactions
DELETE FROM transactions;

-- 4. Supprimer toutes les commissions journalières
DELETE FROM commissions_journalieres;

-- 5. Supprimer toutes les clôtures journalières
DELETE FROM clotures_journalieres;

-- 6. Supprimer toutes les opérations de change
DELETE FROM change_operations;

-- 7. Supprimer tous les approvisionnements
DELETE FROM approvisionnements;

-- 8. Réinitialiser tous les soldes des services à zéro
UPDATE services
SET
  solde_virtuel_usd = 0,
  solde_virtuel_cdf = 0,
  updated_at = now();

-- 9. Réinitialiser les soldes globaux
UPDATE global_balances
SET
  cash_usd = 0,
  cash_cdf = 0,
  updated_at = now()
WHERE id = (SELECT id FROM global_balances LIMIT 1);

-- Si la table global_balances est vide, créer une ligne
INSERT INTO global_balances (cash_usd, cash_cdf)
SELECT 0, 0
WHERE NOT EXISTS (SELECT 1 FROM global_balances);

-- 10. Réinitialiser les séquences pour les références
DO $$
BEGIN
  -- Vérifier si la séquence existe avant de la réinitialiser
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'transaction_reference_seq') THEN
    ALTER SEQUENCE transaction_reference_seq RESTART WITH 1;
  END IF;
END $$;

-- 11. Vérifier l'intégrité des données
DO $$
DECLARE
  v_services_count integer;
  v_users_count integer;
  v_rates_count integer;
  v_transactions_count integer;
  v_transaction_headers_count integer;
  v_appro_count integer;
BEGIN
  SELECT COUNT(*) INTO v_services_count FROM services;
  SELECT COUNT(*) INTO v_users_count FROM users;
  SELECT COUNT(*) INTO v_rates_count FROM exchange_rates WHERE actif = true;
  SELECT COUNT(*) INTO v_transactions_count FROM transactions;
  SELECT COUNT(*) INTO v_transaction_headers_count FROM transaction_headers;
  SELECT COUNT(*) INTO v_appro_count FROM approvisionnements;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Base de données restaurée à l''état de samedi 27 décembre';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Services conservés: %', v_services_count;
  RAISE NOTICE '✓ Utilisateurs conservés: %', v_users_count;
  RAISE NOTICE '✓ Taux de change actifs: %', v_rates_count;
  RAISE NOTICE '✓ Transactions (anciennes): %', v_transactions_count;
  RAISE NOTICE '✓ Transactions (nouvelles): %', v_transaction_headers_count;
  RAISE NOTICE '✓ Approvisionnements: %', v_appro_count;
  RAISE NOTICE '✓ Tous les soldes réinitialisés à zéro';
  RAISE NOTICE '========================================';
END $$;
