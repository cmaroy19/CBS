/*
  # Fix Dashboard View - Utiliser global_balances directement

  1. Problème
    - La vue dashboard_stats_fast cherche operation='credit'/'debit'
    - Mais nous utilisons operation='entree'/'sortie'
    - Résultat: cash_usd/cash_cdf retournent toujours 0

  2. Solution
    - Lire directement depuis global_balances pour cash
    - Calculer virtuel depuis services (correct)
    - Plus besoin de calculer cash depuis approvisionnements
*/

-- Supprimer ancienne vue
DROP VIEW IF EXISTS dashboard_stats_fast;

-- Créer nouvelle vue utilisant global_balances
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
  
  -- Stats du jour
  COALESCE((SELECT COUNT(*) FROM transactions WHERE created_at::date = CURRENT_DATE), 0)::int as transactions_today,
  COALESCE((SELECT COUNT(*) FROM approvisionnements WHERE created_at::date = CURRENT_DATE), 0)::int as approvisionnements_today,
  COALESCE((SELECT COUNT(*) FROM change_operations WHERE created_at::date = CURRENT_DATE), 0)::int as change_operations_today,
  
  -- Commissions et volumes
  COALESCE((SELECT SUM(commission) FROM transactions WHERE created_at::date = CURRENT_DATE), 0) as commissions_today_usd,
  COALESCE((SELECT SUM(montant) FROM transactions WHERE created_at::date = CURRENT_DATE AND devise = 'USD'), 0) as volume_today_usd,
  COALESCE((SELECT SUM(montant) FROM transactions WHERE created_at::date = CURRENT_DATE AND devise = 'CDF'), 0) as volume_today_cdf,
  
  -- Compteurs
  COALESCE((SELECT COUNT(*) FROM services WHERE actif = true), 0)::int as services_actifs,
  COALESCE((SELECT COUNT(*) FROM users WHERE actif = true), 0)::int as users_actifs,
  
  now() as updated_at;
