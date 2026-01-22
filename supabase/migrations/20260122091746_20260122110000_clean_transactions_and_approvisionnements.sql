/*
  # Nettoyage des Transactions et Approvisionnements

  ## Description
  Cette migration vide toutes les données de transactions et d'approvisionnements
  tout en conservant les services et les utilisateurs.

  ## Tables vidées
  1. **transaction_lines** - Lignes de transactions
  2. **transaction_headers** - En-têtes de transactions
  3. **transactions** - Anciennes transactions (table legacy)
  4. **approvisionnements** - Approvisionnements
  5. **commissions_journalieres** - Commissions journalières
  6. **clotures_journalieres** - Clôtures journalières de services
  7. **change_operations** - Opérations de change

  ## Réinitialisation des soldes
  - **global_balances** : cash_usd = 0, cash_cdf = 0
  - **services** : solde_virtuel_usd = 0, solde_virtuel_cdf = 0

  ## Données préservées
  - Utilisateurs (users)
  - Services (services)
  - Taux de change (exchange_rates)
  - Configuration système

  ## Important
  Cette opération est irréversible. Toutes les transactions et approvisionnements
  seront définitivement supprimés.
*/

-- Supprimer dans l'ordre pour respecter les contraintes de clés étrangères

-- 1. Supprimer toutes les lignes de transactions (dépendent des headers)
DELETE FROM transaction_lines;

-- 2. Supprimer tous les en-têtes de transactions
DELETE FROM transaction_headers;

-- 3. Supprimer les anciennes transactions (table legacy)
DELETE FROM transactions;

-- 4. Supprimer tous les approvisionnements
DELETE FROM approvisionnements;

-- 5. Supprimer toutes les commissions journalières
DELETE FROM commissions_journalieres;

-- 6. Supprimer toutes les clôtures journalières
DELETE FROM clotures_journalieres;

-- 7. Supprimer toutes les opérations de change
DELETE FROM change_operations;

-- 8. Réinitialiser les soldes globaux à zéro
UPDATE global_balances
SET
  cash_usd = 0,
  cash_cdf = 0,
  updated_at = now();

-- 9. Réinitialiser les soldes virtuels des services à zéro
UPDATE services
SET
  solde_virtuel_usd = 0,
  solde_virtuel_cdf = 0,
  updated_at = now();

-- Afficher un résumé des opérations
DO $$
DECLARE
  v_nb_users integer;
  v_nb_services integer;
  v_nb_taux integer;
BEGIN
  SELECT COUNT(*) INTO v_nb_users FROM users;
  SELECT COUNT(*) INTO v_nb_services FROM services;
  SELECT COUNT(*) INTO v_nb_taux FROM exchange_rates WHERE actif = true;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'NETTOYAGE TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Données supprimées :';
  RAISE NOTICE '  ✓ Toutes les transactions (headers + lines)';
  RAISE NOTICE '  ✓ Toutes les anciennes transactions (legacy)';
  RAISE NOTICE '  ✓ Tous les approvisionnements';
  RAISE NOTICE '  ✓ Toutes les commissions journalières';
  RAISE NOTICE '  ✓ Toutes les clôtures journalières';
  RAISE NOTICE '  ✓ Toutes les opérations de change';
  RAISE NOTICE '';
  RAISE NOTICE 'Soldes réinitialisés à 0 :';
  RAISE NOTICE '  ✓ Cash USD et CDF';
  RAISE NOTICE '  ✓ Soldes virtuels de tous les services';
  RAISE NOTICE '';
  RAISE NOTICE 'Données préservées :';
  RAISE NOTICE '  ✓ % utilisateur(s)', v_nb_users;
  RAISE NOTICE '  ✓ % service(s)', v_nb_services;
  RAISE NOTICE '  ✓ % taux de change actif(s)', v_nb_taux;
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'La base de données est maintenant prête pour de nouvelles opérations.';
END $$;

COMMENT ON TABLE transaction_headers IS 'Table des en-têtes de transactions - Nettoyée le 22 janvier 2026';
COMMENT ON TABLE transaction_lines IS 'Table des lignes de transactions - Nettoyée le 22 janvier 2026';
COMMENT ON TABLE approvisionnements IS 'Table des approvisionnements - Nettoyée le 22 janvier 2026';
COMMENT ON TABLE transactions IS 'Table legacy des transactions - Nettoyée le 22 janvier 2026';
