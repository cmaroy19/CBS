/*
  # Correction Dashboard - Utiliser transaction_headers au lieu de transactions
  
  1. Problème
    - La vue dashboard_stats_fast compte depuis l'ancienne table 'transactions'
    - Mais maintenant nous utilisons 'transaction_headers' pour toutes les transactions
    - Résultat: Le compteur n'affiche que les anciennes transactions (2 au lieu de 7+)
  
  2. Solution
    - Mettre à jour la vue pour compter depuis transaction_headers
    - Utiliser statut='validee' pour ne compter que les transactions validées
    - Adapter les calculs de volumes pour utiliser transaction_headers
    - Garder les commissions depuis l'ancienne table transactions (pour compatibilité)
*/

-- Supprimer l'ancienne vue
DROP VIEW IF EXISTS dashboard_stats_fast;

-- Créer la nouvelle vue utilisant transaction_headers
CREATE VIEW dashboard_stats_fast AS
SELECT 
  -- Cash depuis global_balances (SOURCE DE VÉRITÉ)
  COALESCE((SELECT cash_usd FROM global_balances LIMIT 1), 0) as cash_usd,
  COALESCE((SELECT cash_cdf FROM global_balances LIMIT 1), 0) as cash_cdf,
  
  -- Virtuel depuis services (correct)
  COALESCE((SELECT SUM(solde_virtuel_usd) FROM services WHERE actif = true), 0) as virtual_usd,
  COALESCE((SELECT SUM(solde_virtuel_cdf) FROM services WHERE actif = true), 0) as virtual_cdf,
  
  -- Total trésorerie = cash + virtuel
  COALESCE((SELECT cash_usd FROM global_balances LIMIT 1), 0) + 
    COALESCE((SELECT SUM(solde_virtuel_usd) FROM services WHERE actif = true), 0) as total_tresorerie_usd,
  COALESCE((SELECT cash_cdf FROM global_balances LIMIT 1), 0) + 
    COALESCE((SELECT SUM(solde_virtuel_cdf) FROM services WHERE actif = true), 0) as total_tresorerie_cdf,
  
  -- Stats du jour (depuis transaction_headers)
  COALESCE((SELECT COUNT(*) FROM transaction_headers WHERE created_at::date = CURRENT_DATE AND statut = 'validee'), 0)::int as transactions_today,
  COALESCE((SELECT COUNT(*) FROM approvisionnements WHERE created_at::date = CURRENT_DATE), 0)::int as approvisionnements_today,
  COALESCE((SELECT COUNT(*) FROM change_operations WHERE created_at::date = CURRENT_DATE), 0)::int as change_operations_today,
  
  -- Commissions (depuis ancienne table transactions pour compatibilité)
  COALESCE((SELECT SUM(commission) FROM transactions WHERE created_at::date = CURRENT_DATE), 0) as commissions_today_usd,
  
  -- Volumes (depuis transaction_headers)
  COALESCE((SELECT SUM(montant_total) FROM transaction_headers WHERE created_at::date = CURRENT_DATE AND statut = 'validee' AND devise_reference = 'USD'), 0) as volume_today_usd,
  COALESCE((SELECT SUM(montant_total) FROM transaction_headers WHERE created_at::date = CURRENT_DATE AND statut = 'validee' AND devise_reference = 'CDF'), 0) as volume_today_cdf,
  
  -- Compteurs
  COALESCE((SELECT COUNT(*) FROM services WHERE actif = true), 0)::int as services_actifs,
  COALESCE((SELECT COUNT(*) FROM users WHERE actif = true), 0)::int as users_actifs,
  
  now() as updated_at;
